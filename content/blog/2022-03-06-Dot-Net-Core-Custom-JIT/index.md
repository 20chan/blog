---
title: .net 커스텀 JIT 컴파일러
date: 2022-03-06
description: 런타임 JIT 후킹으로 IL 코드 몽키패칭
---

3년전에 따라하다 싶이 만들었던 [프로토타입 프로젝트](https://github.com/20chan/CoreCLRCustomJIT)가 있었다. 오랜만에 보니 이렇게 재밌는걸 썩혀둘 수가 없어서 그럴싸하게 만들어보기로 했다.

일단 결과만 보자면 이런 코드가 나온다.

```csharp
static void Main(string[] args) {
  var hooker = new JITHooker();
  if (hooker.Hook()) {
    Console.WriteLine("hook sucucess");
  }

  Console.WriteLine(ExOne()); // prints 2, not 1
  Console.WriteLine(ExAdd()); // prints 3, not 30
  Console.Read();
}

[HookOverwrite(0x25, 2)]
static int ExOne() {
  return 1;
}

[HookOverwrite(0x2b, 1)]
[HookOverwrite(0x32, 2)]
static int ExAdd() {
  int a = 10;
  int b = 20;
  return Add(a, b);
}

static int Add(int a, int b) => a + b;
```

위 코드에서 `ExOne()`은 자명하게 1을 리턴해야 하지만, 실제 결과값은 2가 나오고 있고, 유일한 단서는 메서드에 붙은 어트리뷰트 `HookOverwrite(0x25, 2)` 이다. 눈치챘겠지만 대충 결과값을 2로 바꿔주는 것인데, 정확히는 .net core의 JIT 컴파일러가 IL code를 machine code로 변환하는 컴파일러 메서드를 후킹해 머신코드 포스트 프로세싱이 가능하게 만들었다.

## jit

.net core 3.* 기준으로 생각하자. 하지만 대체로 .net framework부터 .net 까지 적용된다.

과정은 다음과 같다.
1. JIT 컴파일러의 컴파일 함수 메모리 주소를 찾는다.
2. 컴파일 함수를 trampoline 시킨다.
3. 함수의 정보를 불러와 후처리한다.

.net core의 런타임 CoreCLR은 [RyuJIT](https://github.com/dotnet/coreclr/blob/v3.1.22/Documentation/botr/ryujit-overview.md)이라고 하는 JIT 컴파일러를 사용해 IL코드를 네이티브 머신 코드로 컴파일한다. 컴파일 함수는 `ICorJitCompiler.compileMethod`인데, 해당 함수의 메모리 주소를 바로 가져올 방법은 없다. 대신 현재 jit 컴파일러의 인스턴스 `ICorJitCompiler*`를 받을 수 있는 [`getJit`](https://github.com/dotnet/coreclr/blob/v3.1.22/src/inc/corjit.h#L215) 함수가 있다.

`getJit()`은 `ICorJitCompiler*`를 반환하는데, [`ICorJitCompiler` 클래스](https://github.com/dotnet/coreclr/blob/v3.1.22/src/inc/corjit.h#L224)는 다음처럼 virtual 함수들이 선언되어있다.

```cpp
class ICorJitCompiler
{
  public:
    virtual CorJitresult __stdcall compileMethod (...) = 0;
    virtual void clearCache() = 0;
    virtual void ProcessShutdownWork(ICorStaticInfo* info) {};
    virtual void getVersionIdentifier(...) = 0;
    // ...
}
```

그렇다면 `ICorJitCompiler*`에 위치한 [vtable](https://ko.wikipedia.org/wiki/%EA%B0%80%EC%83%81_%EB%A9%94%EC%86%8C%EB%93%9C_%ED%85%8C%EC%9D%B4%EB%B8%94)에는 다음과 같은 메모리 레이아웃이 구성되어 있을 것이다.

```
0: &compileMethod
4: &clearCache
8: &ProcessShutdownWork
c: &getVersionIdentifier
```

그렇다면 `*getJit() +0`은 `compileMethod` 함수일테고, 일단 여기까지 가져와보자.
프로세스로부터 cltjit의 모듈을 가져와 함수를 가져올 수 있다. [`GetProcAddress`](https://www.pinvoke.net/default.aspx/kernel32.getprocaddress) winapi를 사용한다.

```csharp
foreach (ProcessModule module in Process.GetCurrentProcess().Modules) {
  if (Path.GetFileName(module.FileName) == "clrjit.dll") {
    var jitAddr = GetProcAddress(module.BaseAddress, "getJit");
  }
}
```

`getJit`의 함수 위치를 가져왔으니 함수를 호출해 실제 jitCompiler 인스턴스를 가져온다.

```csharp
[UnmanagedFunctionPointer(CallingConvention.StdCall)]
delegate IntPtr GetJitDelegate();

var getJit = Marshal.GetDelegateForFunctionPointer<GetJitDelegate>(jitAddr);
var jit = getJit();
```

그리고 `ICorJitCompiler`의 vtable을 읽어 `compileMethod`의 함수를 가져온다.

```csharp
[UnmanagedFunctionPointer(CallingConvention.StdCall)]
internal delegate int CompileMethodDelegate(
    IntPtr thisPtr,
    IntPtr comp,
    ref CORINFO_METHOD_INFO info,
    uint flags,
    out IntPtr nativeEntry,
    out int nativeSizeOfCode
);

var jitTable = Marshal.ReadIntPtr(jit);
var compileMethodPtr = Marshal.ReadIntPtr(jitTable, 0);
var originalCompileMethod = Marshal.GetDelegateForFunctionPointer<CompileMethodDelegate>(compileMethodPtr);
```

이제 `compileMethod`를 치환해줄건데, 기존 JIT의 `compileMethod`를 사용해야 하니 `originalCompileMethod`로 저장된 값은 gc로 사라지면 안되므로 전역 변수로 만들어줘야 한다. 이제 우리가 만든 새 `compileMethod` 함수를 저기에 넣어주면 될 것 같지만, 그렇게 쉽게 되진 않는다.

## trampoline

그렇다면 `NewCompileMethod`를 만들고 이걸 바로 치환하려하면 어떻게 될까?

```csharp
int NewCompileMethod(...) {}

var replaceCompileMethod = (CompileMethodDelegate)NewCompileMethod;
var replacedCompileMethodPtr = Marshal.GetFunctionPointerForDelegate(_replacedCompileMethod);
// 실제론 memory readwrite를 설정해주어야 한다
Marshal.WriteIntPtr(jitTable, 0, replacedCompileMethodPtr);
```

그리고 적당히 코드를 돌리면 후킹이 끝난 뒤 아무 함수를 호출하면 unmanaged 단계에서의 stackoverflow exception이 나온다.

그렇다면 정확히 무엇이 문제일까? 첫번재로, 아직 `NewCompileMethod` 함수는 JTI 컴파일되지 않은 상태이다. `NewCompileMethod` 함수를 컴파일하기 위해 `NewCompileMethod` 함수가 불리고, 다시 그 상황이 반복되어 스택오버플로우가 발생한다.

그렇다면 후킹 전 `NewCompileMethod` 함수를 호출하면 문제가 해결될까? 그것도 아니다.

GC가 있는 managed language C#에서 unmanaged c++ 함수를 가져와 호출하는건 문제가 없는데, unmanaged에서 managed 코드를 바로 사용할 순 없다. 이런 reverse P/Invoke 상황에서는 JIT이 trampoline 함수를 만들어줘 사용한다. 즉 c#에서 `Marshal.GetFunctionPointerForDelegate`로 만든 함수는 실제 함수가 아닌 [trampoline/thunk](https://en.wikipedia.org/wiki/Thunk) 함수를 가리키고 있다.
우리가 `Marshal.GetFunctionPointerForDelegate` 로 가져온 `replacedCompileMethodPtr`가 가르키는 함수는 unmanaged에서 불린적이 없어 JIT 컴파일이 안되어 있는 상황이다. 즉 우리가 unmanaged 단계에서 함수를 미리 불러줘야 하고, 이를 trampoline이라 한다.

이 thunk에 관해 자세한건 [정성태님의 글](https://www.sysnet.pe.kr/2/0/12133#fixup_precode)과 [Matt Warren](https://mattwarren.org/2017/01/25/How-do-.NET-delegates-work/)의 글에 잘 설명되어 있다.

그렇다면 trampoline function을 만들고 불러 `NewCompileMethod`를 준비된 상태로 만들어보자.

```csharp
readonly byte[] DelegateTrampolineCode = {
  // mov rax, 0000000000000000h ;
  0x48, 0xB8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  // jmp rax
  0xFF, 0xE0
};

void AllocateTrampoline(IntPtr dest) {
  var jmp = VirtualAlloc(IntPtr.Zero, DelegateTrampolineCode.Length, AllocationType.Commit, MemoryProtection.ExecuteReadWrite);
  Marshal.Copy(DelegateTrampolineCode, 0, jmp, DelegateTrampolineCode.Length);
  Marshal.WriteIntPtr(jmp, 2, dest);
  return jmp;
}
```

과거 [AssemblySharp](https://github.com/20chan/AssemblySharp/blob/master/AssemblySharp/X86Assembly.cs#L127) 프로젝트에서 이런 코드를 작성해본 적이 있다. executable한 메모리 공간을 할당해, 머신코드를 밀어넣고 함수 포인터로 가져와 실행시킨다.

`DelegateTrampolineCode`는 함수 위치로 jump 시키는 코드이고 여기에 `NewCompileMethod` 함수 위치를 넣어 메모리에 올려준다. 이렇게 `NewCompileMethod` 함수를 호출하는 unmanaged 함수를 컴파일한 셈이다.

```csharp
var trampolinePtr = AllocateTrampoline(replacedCompileMethodPtr);
var trampoline = Marshal.GetDelegateForFunctionPointer<CompileMethodDelegate>(trampolinePtr);

var emptyInfo = default(CORINFO_METHOD_INFO);
trampoline(IntPtr.Zero, IntPtr.Zero, ref emptyInfo, 0, out var _, out var _);

VirtualFree(trampolinePtr, new IntPtr(DelegateTrampolineCode.Length), FreeType.Release);
```

이렇게 `trampoline` 함수를 불러주고 free해주면 `NewCompileMethod`는 완전히 준비된 상태이다. 이제 jitTable에 `NewCompileMethod`를 넣어주면 된다.

```csharp
VirtualProtect(jitTable, new IntPtr(IntPtr.Size), MemoryProtection.ReadWrite, out var oldFlags);
Marshal.WriteIntPtr(jitTable, 0, replacedCompileMethodPtr);
VirtualProtect(jitTable, new IntPtr(IntPtr.Size), oldFlags, out _);
```

그리고 `NewCompileMethod`를 적당히 채워주면 실제로 돌아가는 compileMethod post processor를 볼 수 있다.

```csharp
int NewCompileMethod(
  IntPtr thisPtr,
  IntPtr comp,
  ref CORINFO_METHOD_INFO info,
  uint flags,
  out IntPtr nativeEntry,
  out int nativeSizeOfCode) {
  
  var res = originalCompileMethod(thisPtr, comp, ref info, flags, out nativeEntry, out nativeSizeOfCode);

  var codes = new byte[nativeCodeSize];
  Marshal.Copy(nativeCodePtr, codes, 0, nativeCodeSize);
  Console.WriteLine(BitConverter.ToString(codes));

  // you also can touch nativeEntry
  // Marshal.WriteByte(nativeEntry, 0x25, 10);
  return res;
}
```

## metadata

하지만 저렇게 만들어진 `NewCompileMethod`는 모든 함수에 대해 호출되는데, 해당 함수의 정보 없이는 유용한 작업이 불가능하고 함수의 정보를 알 방법이 없다.

compileMethod의 정의는 다음과 같다.

```cpp
virtual CorJitResult __stdcall compileMethod (
  ICorJitInfo                 *comp,               /* IN */
  struct CORINFO_METHOD_INFO  *info,               /* IN */
  unsigned /* code:CorJitFlag */   flags,          /* IN */
  BYTE                        **nativeEntry,       /* OUT */
  ULONG                       *nativeSizeOfCode    /* OUT */
  ) = 0;
```

여기서 메서드의 정보를 담고 있을 것처럼 보이는 `ICorJitInfo *comp`를 보자. `ICorJitInfo` 클래스의 정의는 다음과 같다.

```cpp
class ICorJitInfo : public ICorDynamicInfo
{ /* ... */ }

class ICorDynamicInfo : public ICorStaticInfo
{ /* ... */ }
```

그리고 이렇게 상속을 따라 나온 `ICorStaticInfo`에는 다음 함수들이 있다.

```cpp
class ICorStaticInfo
{
  /* ... */
  // this function is for debugging only. Returns method token.
  // Returns mdMethodDefNil for dynamic methods.
  virtual mdMethodDef getMethodDefFromMethod(
    CORINFO_METHOD_HANDLE hMethod
    ) = 0;

  // this function is for debugging only.  It returns the method name
  // and if 'moduleName' is non-null, it sets it to something that will
  // says which method (a class name, or a module name)
  virtual const char* getMethodName (
    CORINFO_METHOD_HANDLE       ftn,        /* IN */
    const char                **moduleName  /* OUT */
    ) = 0;
}
```

여기서 `getMethodDefFromMethod` 함수를 호출해 함수의 위치로부터 method token을 얻어내서, 어셈블리 모듈로부터 method token을 통해 최종적으로 MethodBase를 리플렉션으로 가져올 것이다.

`ICorJitInfo` 인스턴스로부터 `getMethodDefFromMethod` 함수의 위치는 위에서 `compileMethod` 함수의 위치를 가져올 때와 같이 vtable에서 위치를 보고 가져올 것이다. 내가 사용하는 버젼인 v3.1.22에서 [`ICorStaticInfo`](https://github.com/dotnet/coreclr/blob/v3.1.22/src/inc/corjit.h#L292)에서 `getMethodDefFromMethod`가 위에서 몇번째로 정의되어 있는지 하나하나 세준다... 여기가 제일 고역이었다. `virtual` 검색 후 위치로 찾았는데 주석에도 virtual 이란 단어가 있어 실제 위치랑 다른 값을 넣어 엉뚱한 함수가 호출돼 프로그램이 터졌었다. 아무튼 잘 세주면, `getMethodDefFromMethod`는 116번째에 위치해 있다. 외에도 좀 더 몇개의 함수를 가져와 현재 어셈블리를 가져와 함수가 위치한 모듈을 알아내 함수의 리플렉션 정보를 가져오면 된다.

```csharp
private int NewCompileMethod(
  IntPtr thisPtr,
  IntPtr comp,
  ref CORINFO_METHOD_INFO info,
  uint flags,
  out IntPtr nativeEntry,
  out int nativeSizeOfCode) {
  var res = _originalCompileMethod(thisPtr, comp, ref info, flags, out nativeEntry, out nativeSizeOfCode);

  var vtableCorJitInfo = Marshal.ReadIntPtr(comp);

  // https://github.com/dotnet/coreclr/blob/v3.1.22/src/inc/corinfo.h#L2906
  var getMethodDefFromMethodPtr = Marshal.ReadIntPtr(vtableCorJitInfo, IntPtr.Size * 116);
  var getMethodDefFromMethod = Marshal.GetDelegateForFunctionPointer<GetMethodDefFromMethodDelegate>(getMethodDefFromMethodPtr);
  var methodToken = getMethodDefFromMethod(comp, info.ftn);

  // https://github.com/dotnet/coreclr/blob/v3.1.22/src/inc/corinfo.h#L2387
  var getModuleAssemblyDelegatePtr = Marshal.ReadIntPtr(vtableCorJitInfo, IntPtr.Size * 48);
  var getModuleAssemblyDelegate = Marshal.GetDelegateForFunctionPointer<GetModuleAssemblyDelegate>(getModuleAssemblyDelegatePtr);
  var assemblyHandle = getModuleAssemblyDelegate(comp, info.scope);

  Assembly assembly = null;
  if (!assemblies.TryGetValue(assemblyHandle, out assembly)) {
    // https://github.com/dotnet/coreclr/blob/v3.1.22/src/inc/corinfo.h#L2392
    var getAssemblyNamePtr = Marshal.ReadIntPtr(vtableCorJitInfo, IntPtr.Size * 49);
    var getAssemblyName = Marshal.GetDelegateForFunctionPointer<GetAssemblyNameDelegate>(getAssemblyNamePtr);
    var assemblyNamePtr = getAssemblyName(comp, assemblyHandle);

    var assemblyName = Marshal.PtrToStringAnsi(assemblyNamePtr);

    foreach (var asm in AppDomain.CurrentDomain.GetAssemblies()) {
      if (asm.GetName().Name == assemblyName) {
        assembly = asm;
        break;
      }
    }

    assemblies.Add(assemblyHandle, assembly);
  }

  if (assembly != null) {
    MethodBase method = null;
    foreach (var module in assembly.Modules) {
      try {
        method = module.ResolveMethod(methodToken);
      } catch {
      }
    }

    if (method != null) {
      // POST-PROCESS-METHOD-COMPILE!!
      PostProcessCompile(method, info.ILCode, info.ILCodeSize, nativeEntry, nativeSizeOfCode);
    }
  }
  return res;
}
```

그렇다면 골치아픈 부분들은 전부 해결됐다. 위 코드 마지막 `PostProcessCompile`에 마음껏 이상한 짓을 할 수 있다. 가장 처음 보였던 것처럼 어트리뷰트로 포스트 프로세싱을 처리할 수도 있다.

```csharp
var attrs = method.GetCustomAttributes<HookAttribute>(true);
foreach (var attr in attrs) {
  attr.PostProcess(ilCodePtr, ilSize, nativeCodePtr, nativeCodeSize);
}
```

플러그인 없이 환상적이고 버젼/플랫폼 의존적인(이것도 충분히 해결 가능하긴 함) AOT를 구현했다. 여기서 더 나아가자면, 전처리로 코드 중간에 IL 코드를 삽입하는 것도 가능할테고 후처리로 코드에 원하는 부분에 어셈블리 코드를 삽입하는 것도 가능할 것이다. 시간 나면 하나하나 만들어보겠지

여기에 나온 모든 코드들에서는 중복 실행/락 등의 문제는 생략했지만, 실제 코드에서는 전부 처리해주고 있다.

깃헙 리포: [flexil](https://github.com/20chan/flexil)

3년전, [AssemblySharp](https://github.com/20chan/AssemblySharp) 프로젝트를 마무리한지 1년정도 지났을 때 xoofx의 포스트 [Writing A Managed JIT in C# with CoreCLR](https://xoofx.com/blog/2018/04/12/writing-managed-jit-in-csharp-with-coreclr/) 을 보고 이거다 하는 삘이 꽂혔다. 당시엔 관련 글들과 코드를 읽고 만든 이해도 낮은 클론 프로젝트 정도에 불과해 글을 올리지 못했었는데, 이렇게 재밌는 떡밥을 잘 써먹지 못한게 정말 아쉬웠었다.
이번에 이렇게 떡밥을 다 풀고 나니 후련하다 해야할지 아쉽다 해야할지

## ref
- [xoofx/Writing a Managed JIT in C# with CoreCLR](https://xoofx.com/blog/2018/04/12/writing-managed-jit-in-csharp-with-coreclr/)
- [xoofx/ManagedJit](https://github.com/xoofx/ManagedJit)
- [mattwarren/.NET JIT and CLR - Joined at the Hip](https://mattwarren.org/2018/07/05/.NET-JIT-and-CLR-Joined-at-the-Hip/)
- [ntcore/.NET Internals and Code Injection](https://ntcore.com/files/netint_injection.htm)
- [정성태/C# 9.0의 Function pointer를 이용한 함수 주소 구하는 방법](https://www.sysnet.pe.kr/2/0/12409)

### 작업하면서 들은 노래
- [Weezer/The End of the Game](https://music.youtube.com/watch?v=gHQaNT9fPz8&feature=share)
- [Scorpions/Rock Believer](https://music.youtube.com/watch?v=gsX3fDbj7dE&feature=share)
- [All Time Low/Monsters](https://music.youtube.com/watch?v=M9cfZrLC6Ug&feature=share)
- [Goo Goo Dolls/Iris](https://music.youtube.com/watch?v=Dy_eP-mqWow&feature=share)
- [Unlike Pluto/Oh Raven](https://music.youtube.com/watch?v=cl_NE_Si7hI&feature=share)