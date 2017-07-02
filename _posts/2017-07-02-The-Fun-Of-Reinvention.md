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

```python
class Contract:
    @classmethod
    def check(cls, value):
        pass

class Integer(Contract):
    @classmethod
    def check(cls, value):
        assert isinstance(value, int), 'Expected int'
```

```
>>> Integer.check(1)
>>> Integer.check(1.5)
AssertionError: Expected int
```

Integer 말고도 Float, String 등의 클래스들을 만들어 간단하게 타입 검증을 할 수 있을 것이다. 하지만 단순히 반복되는 코드에 불편함을 느낀다. 

```python
class Contract:
    @classmethod
    def check(cls, value):
        pass

class Typed(Contract):
    @classmethod
    def check(cls, value):
        assert isinstance(value, cls.type), f'Expected {cls.type}'
        super().check(value)

class Integer(Typed):
    type = int

class Float(Typed):
    type = float

class String(Typed):
    type = str
```

한결 간단해졌다!
여기서 나오는 `f'a = {a}'` 은 [PEP 498의 F-String](https://www.python.org/dev/peps/pep-0498/) 이라는 문법이다.

여기서 멈추지 않고 다른 검증 클래스도 만들어보자. 함수 gcd에서 a와 b는 자연수여야 하므로 0보다 커야한다.

```python
class Positive(Contract):
    @classmethod
    def check(cls, value):
        assert value > 0, 'Must be > 0'
        super().check(value)
```

그렇다면 이 검증 클래스들을 사용하여 gcd 함수를 다시 작성해보자.

```python
def gcd(a, b):
    Integer.check(a)
    Positive.check(a)
    Integer.check(b)
    Positive.check(b)

    while b:
        a, b = b, a % b
    return a
```

```
>>> gcd(27, 36)
9
>>> gcd("wow", "such")
AssertionError: Expected <class 'int'>
>>> gcd(-1, 1)
AssertionError: Must be > 0
```

양수의 정수임을 확인하는 PositiveInteger 클래스를 만들자.

```python
class PositiveInteger(Integer, Positive):
    pass
```

`PositiveInteger.check` 는 먼저 `Typed.check` 를 호출한다. 그리고 거기서 `super().check` 를 호출하는데, 이게 `Positive.check` 를 호출하게 된다. 결론적으로 작동이 잘 된다! 이해가 잘 되지 않는 사람들은 [여기를](https://stackoverflow.com/questions/3277367/how-does-pythons-super-work-with-multiple-inheritance) 참고하자.

여기까지의 진행 상황을 [gist에](https://gist.github.com/phillyai/e98aaa4a0d04eb49e9a607e6890e1c0e) 올려두었다. 볼 사람은 보던가!

> To Be Continued.. 저는 기숙사 취침 시간 땜시렁,,ㅎㅎ
