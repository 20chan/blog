---
layout: post
title: 식 본문 함수의 최적화
subtitle: 왜 우리는 람다를 더 써야 하는가
---

C# 6.0 에 추가된 식 본문 함수 (Expression bodied function) 은 함수를 한 줄로 간단하게 정의할 수 있게 해준다. 생소한 개념일 수 있으니 간단한 예시를 들어 보겠다.

```csharp
void WriteLine(string text)
{
    Write(text + "\n")
}

int Add(int a, int b)
{
    return a + b;
}
```

이 두 메서드는 다음과 같이 간단하게 작성할 수 있다.

```csharp
void WriteLine(string text) => Write(text + "\n");
int Add(int a, int b) => a + b;
```

이는 메서드에만 적용될 수 있는 게 아니라 프로퍼티에도 적용할 수 있다. 더 자세한 내용은 [MSDN](https://docs.microsoft.com/ko-kr/dotnet/csharp/programming-guide/statements-expressions-operators/expression-bodied-members)을 참고하자.

내가 지금 전해 주고 싶은 내용은 간단하다. **앞으로 바뀌지 않을, 간단한 식에 대해서는 후자를 사용하자.**


## 왜??


사실 이렇게 람다식으로 간단하게 작성하면 나중에 두줄 이상의 내용을 작성할 때 귀찮게 바꿔야 하는 단점이 있다. 그럼에도 람다식으로 굳이 작성해야 하는 이유는 단순히 코드를 짧게 하는데만 있지 않다.

LINQPad 를 사용하여 다음 두 메서드를 컴파일해보고 비교해보자. 전혀 다를게 없는 코드처럼 보인다.

```csharp
int Add(int a, int b) { return a + b; }
int AddLambda(int a, int b) => a + b;
```

그럼 두 메서드의 IL 코드를 비교해보자.

```IL
g__Add0_0:
IL_0000:  nop         
IL_0001:  ldarg.0     
IL_0002:  ldarg.1     
IL_0003:  add         
IL_0004:  stloc.0     
IL_0005:  br.s        IL_0007
IL_0007:  ldloc.0     
IL_0008:  ret         

g__AddLambda0_1:
IL_0000:  ldarg.0     
IL_0001:  ldarg.1     
IL_0002:  add         
IL_0003:  ret    
```

식 본문으로 선언된 `AddLambda` 메서드는 IL코드가 훨씬 적다. 스택포인터를 사용할 일이 없으니 C# 컴파일러가 알아서 최적화를 해준다.


안타깝게도 이 최적화는 Expression 에만 적용이 된다. Statement 에 대해 테스트를 해보면 똑같음을 알 수 있다.

```csharp
void DoLambda() => Do();
void Do() { Do(); }
```

```IL
g__DoLambda0_0:
IL_0000:  call        g__Do0_1
IL_0005:  nop         
IL_0006:  ret         

g__Do0_1:
IL_0000:  nop         
IL_0001:  call        g__Do0_1
IL_0006:  nop         
IL_0007:  ret  
```

아무튼, 사소한 차이지만 성능 차이를 발생시킨다. 테스트를 해보면 미묘하지만, 차이가 있음을 알 수 있다.

```csharp
int Add(int a, int b) { return a + b; }
int AddLambda(int a, int b) => a + b;

int times = 100000000;
var sw = new System.Diagnostics.Stopwatch();

sw.Start();
for (int i = 0; i < times; i++)
	Add(1, 2);
sw.Stop();

$"Add: {sw.ElapsedMilliseconds}".Dump();

sw.Restart();
for (int i = 0; i < times; i++)
	AddLambda(1, 2);
sw.Stop();

$"AddLambda: {sw.ElapsedMilliseconds}".Dump();
```

```
Add: 370
AddLambda: 301
```


## 그래서?

일단 `Add` 함수가 `AddLambda` 로 최적화가 되어야 한다고 생각되서 roslyn 컴파일러에 [이슈](https://github.com/dotnet/roslyn/issues/26715)를 올렸다.
로즐린 컴파일러에 세번째 이슈 리포팅이다. 내가 올린 이슈대로 앞으로 최적화가 이루어진다면, 내가 말한대로 굳이 람다를 쓸 이유는 없어지겠다. ㅎㅎ...
