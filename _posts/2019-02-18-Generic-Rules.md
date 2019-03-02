---
layout: post
title: Generic rules
subtitle: 제너릭이 짱이다
---

재밌는 글을 찾았다.
C#의 LINQ가 설계 오류로 느리다는 내용이다. [원글 링크](https://medium.com/@antao.almada/netfabric-hyperlinq-generation-operations-6530826a70ca)


보면 대충 다음과 같이 인터페이스를 인자로 받는 코드를

```csharp
void A(IAnswer i) {
    ...
}
```

다음과 같이 제너릭으로 바꿔야 한다는 글이다.

```csharp
void A<TAnswer>(TAnswer t)
    where TAnswer : IAnswer {
    ...
}
```

다를 게 없어 보이는 코드이지만 실제로 작동하는 방식은 꽤 다르고 이로 인해서 퍼포먼스의 차이가 일어난다.

## 컴파일 타임 계산

먼저 C#에서 제너릭이 어떻게 작동하는지 이해할 필요가 있다.

제너릭이 없었던 시절, 리스트를 만들어 오브젝트를 넣기 위해서는 `object`의 리스트인 `ArrayList` 클래스를 사용했다.

```csharp
ArrayList list = new ArrayList();
list.Add(new Person("someone"));
list.Add(new Person("someone"));

Person p = (Person)list[0];
```

원소의 타입을 object로 관리하여 박싱과 언박싱이 일어나고 이러한 이유로 쓸데없는 성능 저하가 일어난다. 그래서 제너릭이 등장한다.

```csharp
List<Person> list = new List<Person>();
list.Add(new Person("someone"));
list.Add(new Person("someone"));

Person p = list[0];
```

제너릭을 사용한 위 코드는 `Person` 타입의 리스트를 만들어 컴파일 타임에서 리스트의 원소를 가져오거나 더할 때 타입 검사를 하고 그 과정에서 쓸데없는 박싱/언박싱이 일어나지 않는다.


런타임 JIT 컴파일러는 제너릭을 사용한 클래스들의 코드를 각각 자동으로 생성해준다.  `class List<T> { ... }` 의 리스트 정의 코드로부터 타입 `T`를 `int` 로 단순치환하여 `class ListOfint { ... }` 코드를 생성하여 사용할 수 있게끔 해준다고 생각할 수 있다.


그리고 이를 통해 `List<int>` 와 `List<string>` 가 다른 클래스임도 알 수 있다. 이를 간단한 예제를 통하여 확인할 수 있다.

```csharp
static void Main(string[] args) {
    var a = new A<int>();
    var b = new A<string>();

    A<int>.Value = 10;
    A<string>.Value = 20;

    Console.WriteLine($"A<int>.Value: {A<int>.Value}");
    Console.WriteLine($"A<string>.Value: {A<string>.Value}");

    Console.Read();
}

class A<T> {
    public static int Value;
    static A() {
        Console.WriteLine($"static A<{typeof(T)}>()");
    }
}
```

```
static A<System.Int32>()
static A<System.String>()
A<int>.Value: 10
A<string>.Value: 20
```


## C#<T> Java<T> Cpp<T>

C#, Java, C++ 세 언어 모두 제너릭을 지원하고 신택스도 거의 비슷하지만 작동 방식은 전혀 다르다.

일단 자바에서의 제너릭은 겉으로 봤을 때는 C#과는 다른게 없다. 하지만 자바에서는 제너릭을 사용한다고 해서 어느 성능 이득을 볼 수 있는 게 아니다. 단순히 컴파일 타임에서 타입 체크만 가능한 것이고 실제 작동에서는 GET/SET 에서 박싱과 언박싱이 그대로 일어난다.

C#에서는 아까 말했듯이 제너릭을 사용한 클래스를 생성하여 사용할 수 있게 한다. 그런데 사실, `List<int>` 클래스를 사용하겠다 하여 `ListOfInt` 클래스를 만들어주는 것과는 살짝 거리가 멀다. 실제로 이것은 C++의 템플릿에 어울리는 설명이며, 악명 높은 템플릿 메타 프로그래밍이 바로 이 방식으로 작동된다. 그래서 컴파일 타임에서 다양한 성능 이득을 볼 수 있는 변태짓이 가능한 것이다. C#에서는 컴파일 타임에서 제너릭이 일어나는 게 아닌 JIT 컴파일러에서 런타임에 일어나게 된다.

## 런타임에서 제너릭 타입 생성

말했듯이, C#의 제너릭의 코드 제너레이션은 런타임에 일어나게 된다. 이를 직접 런타임에서 생성할 수도 있다. `Type.MakeGenericType` 함수는 이를 가능케 해준다.

```csharp
var fib = typeof(Fibonacci<,>);
var a = typeof(Fib0);
var b = typeof(Fib1);

for (int i = 2; i <= 20; i++)
{
    var fib_i = fib.MakeGenericType(a, b);
    a = b;
    b = fib_i;
}

dynamic fib20 = Activator.CreateInstance(b);
var prev = DateTime.Now;
int val = fib20.Value;
```

제너릭으로 20번째 피보나치 수열의 수를 구하는 전체 코드는 길어져서 [gist](https://gist.github.com/phillyai/c1b2169e06a6b5445a0dc2390ecb1d91) 에 따로 올려두었다. 물론 졸라 느리다. 이런거 실무에서 하지 말자

## 결과

처음으로 돌아가, LINQ의 코드를 제너릭으로 사용했을 때 어떻게 바뀌는지 직접 봐보자.

```csharp
class Program {
    static int Say1(TrueAnswer t)
        => t.Answer();

    static int Say2(IAnswer i)
        => i.Answer();

    [SharpLab.Runtime.JitGeneric(typeof(TrueAnswer))]
    static int Say3<TAnswer>(TAnswer t)
        where TAnswer : IAnswer
        => t.Answer();
}

interface IAnswer {
    int Answer();
}

struct TrueAnswer : IAnswer {
    public int Answer() => 42;
}
```

위 코드에서 세 `Say` 메서드는 각각 구조체를 직접 / 인터페이스로 / 제너릭으로 파라미터의 타입을 받는다. 각각이 JIT 컴파일된 결과를 보면 다른 결과를 바로 알 수 있다. 디컴파일 결과는 [sharplab](https://sharplab.io/#v2:EYLgtghgzgLgpgJwDQxNMAfAAgJgARYCMA7HgN4CwAUHrQYQGx4CWAdjHgMoQCehAFABUEAVzgBBVlADuiPDACU1OirwBeAHzyAdJJmJ+CgNzVldIkzYduPHPwCSe2QhZKaq2ppa6pzwyaozWgBtTgALCAQABwAZCGBtACURdmYwOG0AKWYYAHE4VkRmAGN+GB4ouAB7ADMhUQlfRAUFAF0g+kt2Ll4AZgAeQSdEDSFhl0UOlWkwxDg8IaaXEDxHJam6LxgffQR/agBfUyorRBqIYvm13fIOqzxx/aojwKpYUWKOYTFxvBXr5y3dy0LC9FjdR4KdRaAAsOACByAA) 에서 직접 확인할 수 있다.

```jitasm
; Desktop CLR v4.7.3260.00 (clr.dll) on x86.

Program..ctor()
    L0000: ret

Program.Say1(TrueAnswer)
    L0000: mov eax, 0x2a
    L0005: ret 0x4

Program.Say2(IAnswer)
    L0000: push ebp
    L0001: mov ebp, esp
    L0003: call dword [0x45d2008c]
    L0009: pop ebp
    L000a: ret

Program.Say3[[TrueAnswer, _]](TrueAnswer)
    L0000: mov eax, 0x2a
    L0005: ret 0x4

TrueAnswer.Answer()
    L0000: mov eax, 0x2a
    L0005: ret
```

구조체를 직접 받거나 제너릭으로 받을 때에는 직접 `IAnswer.Answer()` 을 호출하지도 않고 컴파일 타임에서 이미 42를 리턴하게끔 컴파일 됐음을 알 수 있다. 굳이 확인하지 않아도 성능 이득이 생겼음을 알 수 있겠다.


C++의 템플릿 메타 프로그래밍을 이용한 흑마법이나 제너릭을 사용한 fork bomb 같은 걸 더 설명하고 싶지만 그건 다음 기회에
