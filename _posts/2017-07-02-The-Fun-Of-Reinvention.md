---
layout: post
title: The Fun Of Reinvention
subtitle: 파이썬3.6으로 흑마법을 부려보자
---

이 글은 [The Fun Of Reinvention](https://www.youtube.com/watch?v=js_0wjzuMfc) 를 보고 정리한 글입니다.

파이썬에서 최대공약수를 구하는 함수를 작성하면 다음과 같다.

```python
def gcd(a, b):
    while b:
        a, b = b, a % b
    return a
```

```
>>> gcd(27, 36)
9
```

알다시피, 파이썬은 동적 타입 언어이다. 우리는 `a, b는 당연히 정수이고 사용자도 그렇게 사용할거야` 라고 생각하고 작성한 코드는 예상하지 못한 결과를 낳을 수 있다.

```
>>> gcd(2.7, 3.6)
4.440892098500626e-16
>>> gcd('12', '8')
TypeError: not all arguments converted during string formatting
```

다행히도 방법이 있다. 파이썬3.6에는 타입 어노테이션이란게 있다!

```python
def gcd(a: int, b: int):
    ...
```

하지만 타입 어노테이션이라는 이름 그대로, 타입 어노테이션은 어노테이션(주석)에 불과하다. 결과값에 아무런 영향을 미치지 않는다. 그래서 우리는 a와 b는 int가 아니면 에러를 일으키게끔 다음과 같이 assert 구문을 추가했다.

```python
def gcd(a, b):
    assert isinstance(a, int), 'Expected int'
    assert isinstance(b, int), 'Expected int'

    while b:
        ...
```

이 코드를 좀 더 파이썬3.6 스럽게 하기 위해, 타입 검증을 위한 프레임워크를 만들어볼 것이다.

> To Be Continued..