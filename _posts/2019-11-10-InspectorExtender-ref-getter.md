---
layout: post
title: Unity InspectorExtender - `ref getter`
subtitle: C# DynamicMethod, ILGenerator 실사용
---

유니티 에디터는 클래스 인스턴스의 직렬화 가능한 변수들을 수정할 수 있게 해주는 확장가능한 인스펙터란게 있다.

![unity inspector example](/img/unity-inspector-example.png)

인스펙터에서는 기본적으로 serialized 되는 변수만 보여지며, 여기서 특정 프로퍼티를 표시하거나 메서드 Invoke 버튼을 만드는 등의 확장은 커스텀 인스펙터를 만듦으로서 가능하다.
그래서 원래는 다음의 퍼블릭 프로퍼티/메서드를 같이 보여주는 간단한 확장 스크립트를 쓰고 있었다.

[gist - InspectorExtender (Old revision)](https://gist.github.com/20chan/892fd69cc1cb875de373a85f0cbab38d/1a5e2ed42ef54d17d263ca9ec3ca57e54e4f0262)

> 이거 만들고 쓴지 한달쯤 뒤에 Odin이란걸 알았지만 귀찮아서 계속 이거 쓰고있음

간단한 원리는 리플렉션으로 public 프로퍼티를 가져와 `GetValue` / `SetValue` 로 값을 변수처럼 다루는 방식이다.

그럭저럭 잘 돌아가서 별 문제없이 사용하고 있었는데 첫 불편함을 느꼈었던건 여러 오브젝트를 쉽게 관리하기위한 관리 오브젝트를 만들던 떄였다.

## 발단

```csharp
public class Manager {
    A a;
    B b;
    C c;

    public float SpeedA {
        get => a.speed;
        set => a.speed = value;
    }

    public float SpeedB {
        get => b.speed;
        set => b.speed = value;
    }
}
```

매우 극단적인 예시지만, 암튼 저 get/set 프로퍼티를 일일히 작성하고 있느니 너무 자바스럽고 짜증나서 c# 7의 ref return을 사용했다.

```csharp
public class Manager {
    A a;
    B b;
    C c;

    public ref float SpeedA => ref a.speed;
    public ref float SpeedB => ref b.speed;
}
```

훨씬 깔끔해졌지만 문제는 이걸 인스펙터에서 일반 프로퍼티처럼 뿌려주고싶은데, 기존 `PropertyInfo.GetValue`를 호출해 값을 가져오던 방식이 ref return 프로퍼티 (귀찮으니 이제 `ref getter` 라고 부르자) 에서는 `NotSupportedException`을 일으키면서 안되더라.

찾아보니 [coreclr에 올라온 이 이슈](https://github.com/dotnet/corefx/issues/26053)가 있었다. 나와 똑같은 상황이었고, GetValue는 똑같이 값을 리턴해야한다는 내용이고, 이미 [풀리퀘](https://github.com/dotnet/coreclr/pull/17639)가 마스터에 머지되었다.

그렇다면 해결되었어야 할 문제인데 유니티에서 일어난다는건?? 유니티 런타임 닷넷 버젼이 완전 구려서 그런거겠지 싶고 당장 알아보기도 귀찮다. 저 PR이 머지된 날짜는 2018년 4월이고 유니티 버젼은 2018.3 이니까 아마 맞을거같다.

하지만 그래도 혹시나 모르는 의구심에 테스트를 해보면

```csharp
class A {
    float val = 10;
    public ref float RefVal => ref val;
}

static void Main() {
    var a = new A();
    var r = a.GetType().GetProperties()[0];
    var val = (float)r.GetValue(a);
    Console.WriteLine(val);
}
```

위 코드는 .net core 3.0 버젼에서는 문제없이 돌아가지만, .net core 2.0에서는 `GetValue` 시점에서 역시 똑같은 `NotSupportedException`이 터진다. 이렇게 되면 완전 유니티 욕하기는 애매하다

## 삽질

결론부터 말하자면, [sof에 올라온 답변](https://stackoverflow.com/questions/23349461/how-do-i-work-around-the-error-byref-return-value-not-supported-in-reflection-i)이 바로 먹혔다.

완전 똑같지는 않지만, C#은 ref를 포인터로 처리하기 때문에 위 상황과 원리는 똑같았다. 방법은 다음과 같다.

1. getter 메서드를 가져온다
2. getter 메서드를 호출하고 포인터를 가져오는 메서드를 생성한다
3. 위 생성한 메서드로 포인터를 가져온 뒤 구조체로 포인터 캐스팅한다

정리된 코드는 다음과 같다.

```csharp
var getter = p.GetGetMethod();
var name = $"TempGet{getter.Name}";

var dm = new DynamicMethod(
    name,
    MethodAttributes.Public | MethodAttributes.Static,
    CallingConventions.Standard,
    typeof(IntPtr),
    new[] { typeof(TC), },
    typeof(TC),
    true
);

var ilg = dm.GetILGenerator();
ilg.Emit(OpCodes.Ldarg_0);
ilg.Emit(OpCodes.Call, getter);
ilg.Emit(OpCodes.Ret);

var funcType = typeof(Func<,>);
var delType = funcType.MakeGenericType(typeof(TC), typeof(IntPtr));
var del = dm.CreateDelegate(delType);
var ptr = (IntPtr)del.DynamicInvoke(instance);
return Marshal.PtrToStructure<TP>(ptr);
```

여기서 핵심인 메서드 제너레이션의 IL 코드는 [sharplab](https://sharplab.io/#v2:C4LglgNgPgAgTARgLACgYGYAE9MGFMDeqmJmAZhAPYCGwm1A3MaRpgE4CmZ5VtmASlwBq1CJgC8APnZd6TFKUzMSrGAgBsM7hRp0A4h2AiIACnwBjAJSFli7AHYtmcwDpBZY/MUBfVN6A===) 에서 확인할 수 있다.

스택오버플로우 답변에 나와있는 위 코드는 구조체 포인터를 구조체로 가져오는 마지막 부분때문에 구조체만 지원을 한다. 굳이 포인터를 IL 밖으로 가져올 필요가 없다. `포인터 -> T`을 해주는 IL 코드 `ldobj !!T`을 추가해 구조체 뿐만 아니라 오브젝트 타입도 돌아가게 만들어준다.

```csharp
var ilg = dm.GetILGenerator();
ilg.Emit(OpCodes.Ldarg_0);
ilg.Emit(OpCodes.Call, getter);
ilg.Emit(OpCodes.Ldobj, typeof(TP));
ilg.Emit(OpCodes.Ret);

var funcType = typeof(Func<,>);
var delType = funcType.MakeGenericType(typeof(TC), typeof(TP));
var del = dm.CreateDelegate(delType);
var value = (TP)del.DynamicInvoke(instance);
return value;
```

(코드의 윗부분은 생략했지만 DynamicMethod의 리턴 타입도 바꿔줬음)

이렇게 어느 ref return 프로퍼티도 값을 가져올 수 있게 되었다. 그렇다면 값을 대입하는건?

역시 똑같이 하면 된다. [sharplab](https://sharplab.io/#v2:C4LglgNgPgAgTARgLACgYGYAE9MGFMDeqmJmAZhAPYCGwm1A3MaRpgE4CmZ5VtmASlwBq1CJgC8APnZd6TFKUzMSrGAgBsPGnQDiHYCIgAKfAGMAlIWWLsAdkymAdILKH5igL6ovKVDgCCADwAKtIA7gAWHJyYwZggmADOwGwArqZ0RAosWHEAbqLuOTLccS6GEtKc3AUQRSTWqhqxmHoGoiGSRkGh9JaR0RwtCclpGVbZNnb0zsKF1j6KjVhqmjAALJgAyvqGnd2d9AA0LbWpHP1RMXEjKemZ1orUs66iEphnHPWYPh5AA=) 을 참고하자.

```csharp
static void SetValueOfRefProperty<TP, TC>(PropertyInfo p, TC instance, TP value) {
    var getter = p.GetGetMethod();
    var name = $"TempSet{getter.Name}";

    var dm = new DynamicMethod(
        name,
        MethodAttributes.Public | MethodAttributes.Static,
        CallingConventions.Standard,
        typeof(void),
        new[] { typeof(TC), typeof(TP) },
        typeof(TC),
        true
    );

    var ilg = dm.GetILGenerator();
    ilg.Emit(OpCodes.Ldarg_0);
    ilg.Emit(OpCodes.Call, getter);
    ilg.Emit(OpCodes.Ldarg_1);
    ilg.Emit(OpCodes.Stobj, typeof(TP));
    ilg.Emit(OpCodes.Ret);

    var funcType = typeof(Action<,>);
    var delType = funcType.MakeGenericType(typeof(TC), typeof(TP));
    var del = dm.CreateDelegate(delType);
    del.DynamicInvoke(instance, value);
}
```

졸라 잘된다.
회사에서 IL 코드 일일히 때려박아서 썼는데 이제 이렇게 이쁘게 만들었으니 내일 출근하면 이걸로 바꿔야지

## 결론

정말 기능적으로 돌아가기는 잘 돌아가더라. 유니티에서도 잘 돌아가기는 했는데 인스펙터에서 계속 해출해서 그떄마다 저렇게 리플렉션에서 메서드 제너레이션을 하면 엄청 느리고 메모리 릭 등도 걱정되더라. 반복 호출에 문제가 있는지 확인을 해야하고 있다면 캐싱을 하던 해야할텐데 몇시간 써도 당장 큰 문제는 없었던 것 같다.

유니티 정말 싫다.
