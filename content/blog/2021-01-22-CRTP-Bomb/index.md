---
title: CRTP Bomb
date: 2021-01-22
description: Nested Curiously Recurring Template Pattern
---

다음 다섯줄의 C# 코드를 컴파일하는데 33초가 걸리며 바이너리 사이즈는 170메가바이트가량 나온다. 세번째 줄에서 `Y.Y`를 `Y.Y.Y.Y`로 늘리면 컴파일이 아예 불가능해진다.

```csharp
class X<A, B, C, D, E, F> {
    class Y : X<Y, Y, Y, Y, Y, Y> {
        Y.Y value;
    }
}
```

일단 어떻게 된 모양인지 분석해보자.

## 준비

```csharp
class X {
    class Y {
    }
}
```

C#에서 중첩 클래스는 위와 같이 클래스 안의 클래스를 만들 수 있게 한다.
여기서 클래스 `X` 안에 `Y`가 있으며, 접근은 `X.Y` 로 할 수 있다.

그렇다면 다음과 같은 꼴을 생각해보자.

```csharp
class X {
    class Y : X {
    }
}
```

중첩 클래스 `Y`는 바깥쪽 클래스 `X`를 상속한다. 즉, `Y` 안에 또 `Y` 클래스가 있다. 여기서 재밌는건, `X.Y` 클래스와 `X.Y.Y` 클래스는 동일하다는 것이다. 계속 내려가 `X.Y.Y.Y` 등도 같다.

이부분을 좀 더 확실하게 이해해보자. 클래스, 즉 타입을 객체(=값)처럼 표기한다면 다음 수도코드처럼 표현할 수 있겠다. 

```csharp
X = {};
X.Y = X;

// X.Y = X.Y.Y = X.Y.Y.Y
```

그리고 살짝 다른 꼴을 보자.

제너릭 클래스 안에 있는 static, 그리고 중첩 클래스는 제너릭 타입마다 생성된다. 예시를 들자면

```csharp
class X<T> {
    public static string Value;
}

X<int>.Value = "1";
X<string>.Value = "2";
// X<int>.Value != X<string>.Value
```

다른 타입 `T`에 대해 클래스 `X<T>`는 완전 다른, 독립적인 클래스로 처리된다. 이는 당연히 중첩 클래스에도 적용이 된다.

```csharp
class X<T> {
    class Y {
    }
}

// X<int>.Y != X<string>.Y
```

위 코드에서 클래스 `X<int>.Y`와 `X<string>.Y`는 다른 클래스라는 것을 알 수 있다.

```csharp
class X<T> {
    class Y {
        Y inner;
    }
}
X<T>.Y outer;
```

여기서 클래스 `Y`에서 선언한 필드 `inner`의 타입 `Y`와, 클래스 바깥쪽에서 선언한 `outer`의 타입 `X<T>.Y`는 같다고 할 수 있다.

마지막으로 한 케이스만 더 보자.

```csharp
class X<T> {}
class Y : X<Y> {}
```

클래스 `Y`는 클래스 `X`를 상속하는데, 타입 파라미터로 자기 자신 `Y`를 패스한다. 별 특별할 건 없지만, 이 케이스를 포함해 위 세개의 케이스를 합쳐 다음과 같은 꼴을 생각해보자.

```csharp
class X<T> {
    class Y : X<Y> {
    }
}
```

## 시작

여기부터가 정말 재밌는 부분이다. 중첩 클래스 `Y`는, 바깥 클래스 `X<T>`를 상속하는데, 타입 파라미터로 `Y`를 넘긴다. 그렇다면 이 `Y`는 임의의 타입 T에 대해서 `X<T>.Y`로 접근할 수 있다.
그렇다면 `X<T>.Y`는 `X<>`꼴이니 `X<T>.Y.Y`라는 타입 역시 존재한다. 그렇다면 클래스 `Y` 내부에서 다음과 같이 `Y.Y` 타입의 변수를 선언할 수 있다.

```csharp
class X<T> {
    class Y : X<Y> {
        Y.Y value;
    }
}
```

여기서 `Y.Y` 타입은 바깥쪽에서 봤을 때, 위에서 설명한 것처럼 `X<T>.Y.Y` 이다.

그리고 여기서 C# 컴파일러의 제너릭 타입 처리에 대한 이해가 필요하다. JIT 컴파일러는 제너릭 클래스의 타입이 **필요할 때 마다 새롭게 생성**된다.

```csharp
class X<T> {}

X<int> a;       -> class X_Int {}    X_Int a;
X<string> b;    -> class X_String {} X_String b;
```

실제로 위와 동일하진 않지만, 매우 비슷하게 제너릭 클래스를 사용할 때 다른 타입에 대해 미리 컴파일타임에 클래스를 새롭게 선언해준다. 이게 위 코드에서 문제되는게 무엇일까? 바로 `Y.Y` 에서 두번째 `.Y` 타입은 새롭게 선언되는 제너릭 타입이라는 것이다.

`Y`클래스 내부에서 생각을 한다. `Y.Y` 타입은 `X<Y.Y>` 타입을 상속해야 한다. 이는 원래 코드에서는 없던 **새로운** 제너릭 타입이고, 컴파일러는 이 타입을 미리 계산해둬야 한다. 그래서 아까의 코드는 먼저 다음과 같이 컴파일된다.

```csharp
class X<T> {
    class Y : X<Y> {
        X<Y>.Y value;
    }
}
```

여기서 신기한건, 내부에서의 `Y.Y` 타입이 아까, 내부 타입 `Y`가 바깥쪽에서 `X<T>.Y`와 같은 형상을 한다는 것이다. 그렇다면 다음과 같은 코드는 어떨까?

```csharp
class X<T> {
    class Y : X<Y> {
        Y.Y.Y value;
    }
}
```

`Y.Y.Y` 타입에서 `Y.Y`는 결국 `Y` 임으로 `(Y.Y).Y`로 묶어서 생각할 수 있다. 그리고 `Y`는 순수 클래스이고 [람다 대수 연산](https://stackoverflow.com/q/3080775)으로 이를 `Y.(Y.Y)`로 묶을 수도 있다. 그렇다면 다음과 같이 전개가 된다.

```csharp
Y.Y.Y
Y.(Y.Y)
X<Y.Y>.Y
X<X<Y>.Y>.Y
```

여기서 어떤 `Y`는 펼쳐지고 어떤 `Y`는 펼쳐지지 않는다고 헷갈릴 수 있는데, 간단하다. 마지막에 붙는 `Y`는 펼쳐질 수 없는 심볼 정도로 생각할 수 있다. 펼쳐질 수 없는 심볼 `Y`를 강조해서 다시 보자.

```csharp
Y.Y.*Y*
Y.(Y.*Y*)
X<Y.*Y*>.*Y*
X<X<*Y*>.*Y*>.*Y*
```

이렇게 마지막 표현식에서는 모든 표시되는 `Y`가 더 전개할 수 없는 형태로 되었다는걸 알 수 있다. 컴파일러는 이런 꼴로 타입을 컴파일한다. 다시 원래 문제로 돌아와, `Y.Y.Y` 타입을 선언한 코드는 다음과 같이 컴파일된다.

```csharp
class X<T> {
    class Y : X<Y> {
        X<X<Y>.Y>.Y value;
    }
}
```

여기까지 빌드업은 끝났다. 이제 정말정말정말 본론이다.

```csharp
class X<A, B> {
    class Y : X<Y, Y> {
        Y.Y value;
    }
}
```

이제 제너릭 클래스 `X`는 타입 파라미터를 두개 받는다. 그리고 `Y`는 `X<Y, Y>`를 상속한다. 이 때 `Y.Y`를 전개하면 다음처럼 된다.

```csharp
class X<A, B> {
    class Y : X<Y, Y> {
        X<Y, Y>.Y value;
    }
}
```

타입 `Y.Y`는 `X<Y, Y>.Y`로 전개되며, 이는 더 전개할 수 없는 표현식이다. 여기에 한번더 `Y`를 중첩시켜보자.

```csharp
class X<A, B> {
    class Y : X<Y, Y> {
        Y.Y.Y value;
    }
}
```

타입 `Y.Y.Y`을 아까와 같은 방법으로 전개해보자.

```csharp
Y.Y.Y
Y.(Y.Y)
X<Y.Y, Y.Y>.Y
X<X<Y, Y>.Y, X<Y, Y>.Y>.Y
```

```csharp
class X<A, B> {
    class Y : X<Y, Y> {
        X<X<Y, Y>.Y, X<Y, Y>.Y>.Y value;
    }
}
```

`Y.Y.Y.Y`는 다음과 같이 전개된다.


```csharp
class X<A, B> {
    class Y : X<Y, Y> {
        X<X<X<Y, Y>.Y, X<Y, Y>.Y>.Y, X<X<Y, Y>.Y, X<Y, Y>.Y>.Y>.Y value;
    }
}
```

이 타입 전개는 굉장히 재귀적이다. 타입 `Y`가 중첩되는 횟수로 타입 `Y(n)`을 `Y.Y..`가 n번 중첩되는 타입이라고 정의하자. 그렇다면 `Y(n)`을 다음과 같은 점화식으로 표현할 수 있다.

```csharp
Y(1) = Y
Y(2) = X<Y(1), Y(1)>.Y
Y(n) = X<Y(n-1), Y(n-1)>.Y
```

그렇다면 제너릭 클래스 `X`의 타입 파라미터 개수를 늘린다면?

```csharp
class X<A, B, C> {
    class Y : X<Y, Y, Y> {
    }
}
```

```csharp
Y(1) = Y
Y(2) = X<Y(1), Y(1), Y(1)>.Y
Y(n) = X<Y(n-1), Y(n-1), Y(n-1)>.Y
```

## 마무리

이제 제너럴하게 타입 파라미터의 개수와 `Y` 중첩 횟수를 가지고 전개식을 충분히 만들 수 있다. 그렇다면 복잡도 또한 충분히 계산 가능해진다.
`n`개의 타입 파라미터를 가지고, `m`번 중첩된다면 심볼 `Y`가 나타나는 개수는 `y(m) = n * y(m - 1) + 1`이라는 점화식으로 계산되어, 일반항은 다음과 같다.

```
y(m) = (n^m - 1) / (n - 1)
```

타입 파라미터가 6개라고 하고, 중첩되는 개수로 심볼 `Y`의 개수를 계산해보면

```
5   1555
6   9331
7   55987
8   335923
9   2015539
10  12093235
```

그리고 실제로 이 코드를 컴파일 했을 때 나온 바이너리 파일의 크기는 (컴파일 타임도 볼 수 있지만 일단 제쳐놓고)

```
단위는 바이트
5   135680
6   788992
7   4707840
8   28222464
9   169310208
10  CRASH
```

그렇다면 심볼의 개수로 용량을 적당히 예측할 수 있다. 심볼 `Y`와 바이너리의 크기의 비율은 84로 점점 수렴하니 그렇다면 크래시나서 컴파일에 실패한 코드도 바이너리파일의 크기를 비교적 꽤 정확히 계산할 수 있다. 그렇다면 중첩 횟수가 10일때의 바이너리 파일 크기는 `1015831740`바이트. 즉 1기가바이트에 달한다.

그렇다면... 타입 파라미터가 8개고 20번 중첩된다면? 다음 코드의 바이너리 크기는?

```csharp
class X<A, B, C, D, E, F, G, H> {
    class Y : X<Y, Y, Y, Y, Y, Y, Y, Y> {
        Y.Y.Y.Y.Y.Y.Y.Y.Y.Y.Y.Y.Y.Y.Y.Y.Y.Y.Y.Y value;
    }
}
```

```
약 13835058055282163712 바이트
약 13835058055 기가바이트
약 13835058 테라바이트
약 13835 페타바이트

컴파일 시간은 86106년
```


## 레퍼런스

- [sharplab](https://sharplab.io/#v2:CYLg1APgAgTABADQDwEEA0AhAfHA3gWACg4S5Y4BNOERJCtCnA401qARgDZb7GA6KgE8ADAG4irNl0pxB7cS0llpFAQNkwFSkh26r96wQGYtpAL5ELhIA===)
- [Curiously recurring template pattern on Wikipedia](https://en.wikipedia.org/wiki/Curiously_recurring_template_pattern)
- [A Dos Attack agains the C# Compiler on mattwarren.org](https://mattwarren.org/2017/11/08/A-DoS-Attack-against-the-C-Compiler/)



## 번외

이 주제는 2018년 위 레퍼런스 아티클을 읽고 관심이 생겨 분석해보자 마음을 먹었지만 성공하지 못했던 문제이다. 그런데 갑자기 삘받아서 제대로 하니까 생각보다 쉽게 풀려버렸고 2년만에 멋진 솔루션을 만들어버렸다.

[![MathIsh-CRTP](./mathish-crtp.png)](https://github.com/Big-BlueBerry/MathIsh/issues/20)

2년만에 이슈를 닫을 수 있어서 기쁘다.
