---
layout: post
title: The Fun Of Reinvention
subtitle: 파이썬3.6으로 흑마법을 부려보자
---

이 글은 [The Fun Of Reinvention](https://www.youtube.com/watch?v=js_0wjzuMfc) 를 보고 정리한 글입니다.

# 1. 어노테이션

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

그렇다면 gcd를 PositiveInteger를 사용하여 다시 작성하면 다음과 같이 된다.

```python
def gcd(a, b):
    PositiveInteger.check(a)
    PositiveInteger.check(b)

    while b:
        ...
```

여기서, 처음 사용했던 타입 어노테이션을 사용할 수는 없을까? 하고 생각한다.

```python
def gcd(a: PositiveInteger, b: PositiveInteger):
    ...
```

당연한 소리지만, 타입도 잘못되었고 아무렇게도 작동하지 않는다. 그렇다면 이를 작동하게 만들어보자.
메서드의 매개변수의 어노테이션을 가져오는 어트리뷰트는 `__annotations__` 이다.

```
>>> gcd.__annotations__
{'a': <class '__main__.PositiveInteger'>, 'b': <class '__main__.PositiveInteger'>}
```

그리고 여기서부터 흑마☆법이 시작된다. `inspect` 모듈은 파이썬 오브젝트에 대한 정보를 가져올 수 있는 모듈이다. `inspect.signature` 함수는 callable 객체의 시그니쳐 정보를 가져온다. 직접 써보는게 백배 나으니까 파이썬 쉘 열고 직접 입력해보자.

```
>>> from inspect import signature
>>> signature(gcd)
<Signature (a:__main__.PositiveInteger, b:__main__.PositiveInteger)>
>>> signature(gcd).bind(1, 4)
<BoundArguments (a=1, b=4)>
>>> signature(gcd).bind(1, 4).arguments
OrderedDict([('a', 1), ('b', 4)])
```

이쯤 왔으면 감이 올것이다. 우리는 어노테이션과 시그니쳐를 비교해, 각각의 경우를 검증할 것이다.

```python
from functools import wraps
from inspect import signature

def checked(func):
    sig = signature(func)
    ann = func.__annotations__
    @wraps(func)
    def wrapper(*args, **kwargs):
        bound = sig.bind(*args, **kwargs)
        for name, val in bound.arguments.items():
            if name in ann:
                ann[name].check(val)
        return func(*args, **kwargs)
    return wrapper
```

우리가 할 것은, 매개변수에 타입 어노테이션을 적용한 함수 gcd에 checked 데커레이터를 설정하는 것 뿐이다.

```python
@checked
def gcd(a: PositiveInteger, b: PositiveInteger):
    while b:
        a, b = b, a % b
    return a
```

실행 결과는 예상했던 대로이다.
```
>>> gcd(-11, 22)
AssertionError: Must be > 0
```

# 2. 클래스 어노테이션

이제 더 깊이 들어가볼 시간이다. 이제는 클래스를 살펴볼 것이다.

```python
class Player:
    def __init__(self, name, x, y):
        self.name = name
        self.x = x
        self.y = y
    
    def left(self, dx):
        self.x -= dx
    
    def right(self, dx):
        self.x += dx
```

제대로 만든 최악의 게임 클래스가 된 것 같다. Player 클래스의 사용은 간단하다. 우리가 이상한 값을 넣지만 않는다면 말이다.

```
>>> p = Player('아드', 10, 2)
>>> p.x
10
>>> p.x = '하핳 받아랏!!'
>>> p.left(-5)
TypeError: unsupported operand type(s) for -=: 'str' and 'int'
```

이를 방지하기 위한 간단한 방법은 우리를 알고 있다. x의 getter/setter, 즉 프로퍼티를 만드는 것이다.

```python
class Player:
    def __init__(self, name, x, y):
        self.name = name
        self.x = x
        self.y = y
    
    @property
    def x(self):
        return self._x
    
    @x.setter
    def x(self, value):
        Integer.check(value)
        self._x = value
```

```
>>> p = Player('아드', 0, 0)
>>> p.x = 10
>>> p.x = '멍츙'
AssertionError: Expected <class 'int'>
```

잘 작동한다. 하지만 일일히 프로퍼티를 만드는 것은 귀찮다. 우리는 더 간결하고 멋있는 방법을 찾을 것이다. 늘 그랬듯이.

일일히 프로퍼티를 만드는 대신 파이썬3.6의 기능들을 사용해 간결하게 하는 것이다!
일단 Contract 클래스에 `__set__` 과 `__set_name__` 메서드를 오버라이드하고 코드를 다음과 같이 수정하자.

```python
class Contract:
    def __set__(self, instance, value):
        self.check(value)
        instance.__dict__[self.name] = value

    def __set_name__(self, owner, name):
        self.name = name

    @classmethod
    def check(cls, value):
        pass
```

그리고 Player의 name이 빈칸이 되지 않아야 하니까 다음 두 검증 클래스를 추가하자. 이름 그대로, `NonEmpty`는 길이가 0보다 큰지 검사를 하고, `NonEmptyString`은 길이가 0보다 큰 문자열인지 검사한다.

```python
class NonEmpty(Contract):
    @classmethod
    def check(cls, value):
        assert len(value) > 0, 'Must be nonmpty'
        super().check(value)

class NonEmptyString(String, NonEmpty):
    pass
```

그리고 Player 클래스도 수정하자. 프로퍼티를 없애고 다음과 같이 말이다.

```python
class Player:
    name = NonEmptyString()
    x = Integer()
    y = Integer()

    def __init__(self, name, x, y):
        self.name = name
        self.x = x
        self.y = y
```

놀랍게도, 이 코드는 다음과 같이 작동한다.

```
>>> p = Player('아드', 0, 0)
>>> p.name = 10
AssertionError: Expected <class 'str'>
>>> p.name = ''
AssertionError: Must be nonmpty
```

다음으로 넘어가기 전에, 이 코드가 어떻게 작동하는지 보고 가자. 자세한 설명은 안하고 코드가 어떻게 돌아가는지만 설명할테니까, 알아서 찾아보자...

먼저 `__set__`과 `__set_name__`이 뭐하는 메서드인지 알아야 할 것 같다. 아는 사람이나 내 설명을 듣느니 구글에 물어보는게 낫겠어라고 생각하는 사람은 넘어가도 좋다.

```python
class SetMe:
    def __set__(self, instance, value):
        print(f'you set {value}!')

    def __set_name__(self, owner, name):
        print(f'you set name {name}!')


class SetU:
    a = SetMe()

    def __init__(self):
        self.a = 'wow'

u = SetU()
u.a = 1
```

위 코드 실행 결과는 다음과 같다.

```
you set name a!
you set wow!
you set 1!
```

`SetMe.__set_name_`가 호출되는 지점은 `a = SetMe()` 이다. `self`에는 `SetMe` 오브젝트가, `owner`에는 `SetMe`클래스가, `name`에는 `a`가 들어간다.

그렇다면 `SetMe.__set__`는? 클래스의 안팎에서, 객체의 어트리뷰트값을 변경할때 어트리뷰트의 `__set__`가 호출 된다. 위 코드에서는 `self.a = 'wow'`와 `u.a = 1`에서, `self`에는 `SetMe` 오브젝트가, `instance`에는 `SetU` 오브젝트가, `value`에는 `'wow'`, `1`이 각각 들어가진다. `__set_name__`과 큰 차이점이라면 호출되는 위치가 클래스이냐 인스턴스이냐 인 것 같다.

그럼 원래로 돌아가, Contract 클래스를 볼까? 스크롤 올리기 귀찮은 사람들을 위해 내가 기꺼이 복사를 해왔다.

```python
class Contract:
    def __set__(self, instance, value):
        self.check(value)
        instance.__dict__[self.name] = value

    def __set_name__(self, owner, name):
        self.name = name
    
    ...

class Player:
    name = NonEmptyString()
    x = Integer()
    y = Integer()
```

이제 다시 코드를 보면 이 코드가 어떻게 작동하는지 알 수 있을 것이다. `x.name` 은 `'x'`이고, `p.x = 'wow'` 는 `Contract.__set__(p.x, p, 'wow')`가 호출한다.

설명을 지지리도 못하는 내 초라한 설명이 끝났으니 본론으로 돌아가자. 1장에서 했듯이, 최대한 파이썬3.6 의 기능을 살려보는 것이다. 이번에는 클래스 어노테이션을 사용할 것이다.

```python
class Player:
    name: NonEmptyString
    x: Integer
    y: Integer
```

어노테이션은 다음과 같이 확인할 수 있다.

```
>>> Player.__annotations__
{'name': <class 'NonEmptyString'>, 'x': <class 'Integer'>, 'y': <class 'Integer'>}
```

이제 이 코드를 아까처럼 작동하게 만들어 보자. 우리는 `Player`의 슈퍼 클래스로 `Base` 클래스를 만들 것이고, `Base`는 `Player`클래스의 각 어트리뷰트를 초기화 할때 약간의 조작(?)을 해줄 것이다.

```python
class Base:
    @classmethod
    def __init_subclass__(cls):
        for name, val in cls.__annotations__.items():
            contract = val()
            contract.__set_name__(cls, name)
            setattr(cls, name, contract)

class Player(Base):
    ...
```

작동할까? 잘 작동한다.

```
>>> p = Player('아드', 0, 0)
>>> p.name = 12
AssertionError: Expected <class 'str'>
```

간단하게 `__init_subclass__`를 설명하자면, `Player.__init__`가 선언되기 전에 호출이 된다. 그래서는 `Player`의 클래스 어노테이션들에 대해 각각 객체를 만들어서 값을 설정해줘서 아까와 같은 결과가 된다. 멋진 신택스 슈거가 된 셈이다.

한발자국만 더 나가서, 단순히 값을 설정하기만 하는 생성자도 생략할 수 있다.

```python
class Base:
    @classmethod
    def __init_subclass__(cls):
        ...
    
    def __init__(self, *args):
        ann = self.__annotations__
        assert len(ann) == len(args), f'Expected {len(ann)} arguments'
        for name, val in zip(ann, args):
            setattr(self, name, val)

    def __repr__(self):
        args = ', '.join(repr(getattr(self, name)) for name in self.__annotations__)
        return f'{type(self).__name__}({args})'
```

객체를 출력할 때 모든 값을 보여주게끔 만든 `__repr__` 메서드는 덤이다. 이렇게 만들었으면 정말로 `Player`의 생성자를 없애고 테스트를 해보자.

```python
class Player(Base):
    name: NonEmptyString
    x: Integer
    y: Integer

    def left(self, dx):
        self.x -= dx

    def right(self, dx):
        self.x += dx
```

엄청 간략해 졌다. 간단한 테스트를 해보면, 역시 잘 된다. 이렇게 잘 되도 될까 생각이 들 정도로 말이다.

```
>>> p = Player('아드', 0, 0)
>>> p
Player('아드', 0, 0)
>>> p.x
0
>>> p.x = '코드엑스'
AssertionError: Expected <class 'int'>
```

그럼 이제 우리가 봐야 할것은 `Player.left`의 `dx`이다. 이는 왠지 자연수이어야 할 것 같고, 왜냐하면 내가 그렇다고 하니까, 그래서 이는 `PositiveInteger`로 꾸며져야 할 필요가 있다.

```python
class Player(Base):
    ...
    def left(self, dx: PositiveInteger):
        self.x -= dx
    
    def right(self, dx: PositiveInteger):
        self.x += dx
```

하지만 아직 우리는 메서드들의 매개변수 어노테이션에 대해서는 손댄적이 없다. `Base.__init_subclass__`에서 해결해야 한다.

```python
class Base:
    @classmethod
    def __init_subclass__(cls):
        for name, val in cls.__dict__.items():
            if callable(val):
                setattr(cls, name, checked(val))

        for name, val in cls.__annotations__.items():
            contract = val()
            contract.__set_name__(cls, name)
            setattr(cls, name, contract)

```

파이썬 데커레이터의 작동 방식을 안다면 바로 이해될 것이다.

```python
@deco
def func:
    pass
```

는

```python
def func:
    pass
func = deco(func)
```

와 같은 작동을 한다. 즉, `Base.__init_subclass__`는 클래스의 메서드들에 대해 자동으로 `checked` 데커레이트를 씌어준다.

잘 맞지 않는 내 감으로도 이 코드는 잘 작동할 것이라고 느껴지지만, 하지만 이 글을 읽는 멋쟁이들을 위해 간단한 결과를 보여주겠다. 우선 지금까지 작성한 코드이다.

```python
class Base:
    @classmethod
    def __init_subclass__(cls):
        for name, val in cls.__dict__.items():
            if callable(val):
                setattr(cls, name, checked(val))

        for name, val in cls.__annotations__.items():
            contract = val()
            contract.__set_name__(cls, name)
            setattr(cls, name, contract)

    def __init__(self, *args):
        ann = self.__annotations__
        assert len(ann) == len(args), f'Expected {len(ann)} arguments'
        for name, val in zip(ann, args):
            setattr(self, name, val)

    def __repr__(self):
        args = ', '.join(repr(getattr(self, name)) for name in self.__annotations__)
        return f'{type(self).__name__}({args})'


class Player(Base):
    name: NonEmptyString
    x: Integer
    y: Integer

    def left(self, dx: PositiveInteger):
        self.x -= dx

    def right(self, dx: PositiveInteger):
        self.x += dx
```

```
>>> p = Player('아드', 0, 0)
>>> p
Player('아드', 0, 0)
>>> p.left(-1)
AssertionError: Must be > 0
```

# 3. 메타클래스

다음은 메타클래스에 관한 설명이다. 하지만 내 설명이 파이썬의 ㅍ도 모르는 사람들에게도 바로 팍팍 꽂히는 설명이 아니기 때문에 [파이썬 문서](https://docs.python.org/3/reference/datamodel.html#metaclasses)를 참고하자.
다음과 같이 클래스를 선언할 때, 실제로 파이썬은 어떻게 작동할까?

```python
class Player(Base):
```

는 다음과 같다.

```python
type.__prepare__('Player', (Base,))
```

여기서 `__prepare__`는 클래스의 어트리뷰트와 메서드들을 키와 밸류로 가지는 딕셔너리를 리턴한다.
간단하게 이를 확인하는 예제 코드를 짜보자.

```python
from collections import OrderedDict
dic = {}


class Meta(type):
    @classmethod
    def __prepare__(cls, *args):
        global dic
        dic = OrderedDict()
        return dic

class Base(metaclass=Meta):
    a = 'wow'
    def __init__(self):
        self.name = '아드'
        self.x = 0
        self.y = 42

print(dic)
```

실행 결과는 다음과 같다.

```python
OrderedDict([('__module__', '__main__'), ('__qualname__', 'Base'), ('a', 'wow'), ('__init__', <function Base.__init__ at 0x011C51E0>)])
```

그러면 이를 반대로 이용해서, `__prepare__`에서 이미 값을 넣어준다면 클래스에서 선언하지 않은 오브젝트를 사용할 수 있지 않을까?

```python
class Meta(type):
    @classmethod
    def __prepare__(cls, *args):
        def see_me():
            return '내가 보이니..?'
        return {'see_me': see_me}

class Base(metaclass=Meta):
    a = see_me()

print(Base.a)
```

```
내가 보이니..?
```

클래스 `Base`에서, 스코프때문에 알 수 없는 함수 `see_me`를 호출했지만 런타임 에러 없이 잘 출력되는 것을 볼 수 있다! 

사실 이건 비밀인데, 메타클래스가 클래스를 선언하기 전에 `__prepare__`를 호출한다면, 클래스를 선언한 뒤에는 `__new__`를 호출한다. 정확히 말하면, `Base = type.__new__(..)`를 호출한다. 
`__new__(meta, name, bases, methods)` 는 `meta`에 메타클래스 자신의 클래스가, `name`에는 생성된 클래스의 이름이, `bases`는 생성된 클래스의 슈퍼 클래스들이 튜플로, `methods`에는 `__prepare__`에서 리턴했고, 클래스의 선언중 값이 채워졌던 딕셔너리 값이 들어가진다.

```python
class Meta(type):
    @classmethod
    def __prepare__(cls, *args):
        return {}

    def __new__(meta, name, bases, methods):
        print(f'name : "{name}", methods: {methods}')
        return super().__new__(meta, name, bases, methods)

class Base(metaclass=Meta):
    pass
```

```python
name : "Base", methods: {'__module__': '__main__', '__qualname__': 'Base'}
```

이렇게 메타클래스를 이용해 클래스에 어트리뷰트를 추가하는 것을 알아보았다. 하지만 지금까지 우리가 한대로라면, 이전의 `내가 보이니..?`를 출력하는 코드에는 문제점이 있다.

```python
class Meta(type):
    @classmethod
    def __prepare__(cls, *args):
        def see_me():
            return '내가 보이니..?'
        return {'see_me': see_me}

    def __new__(meta, name, bases, methods):
        return super().__new__(meta, name, bases, methods)


class Base(metaclass=Meta):
    pass

print(Base.see_me())
```

```
내가 보이니.?
```

바로 원하지 않았던 클래스 외부에서 어트리뷰트로 `see_me`에 접근할 수 있다는 것이다. 내가 원하는 것은 클래스 내부에서만 사용하는 것이었는데! 다양한 해결 방법이 있겠지만 우리는 `collections.ChainMap`이라는 콜렉션을 사용해 이 문제를 해결해보자.

```python
from collections import ChainMap

dic = None

class Meta(type):
    @classmethod
    def __prepare__(cls, *args):
        def see_me():
            return '내가 보이니..?'
        global dic
        dic = ChainMap({}, {'see_me': see_me})
        return dic

    def __new__(meta, name, bases, methods):
        methods = methods.maps[0]
        return super().__new__(meta, name, bases, methods)

class Base(metaclass=Meta):
    a = see_me()

print(Base.a)
print('see_me' in Base.__dict__.keys())
```

```
내가 보이니..?
False
```

`ChainMap`은 여러개의 맵들을 가지는 콜렉션이다. 예제 코드를 보면 쉽게 이해가 갈 것이다.

```python
>>> c = ChainMap({}, {'x': 0, 'y': 0})
>>> c['x']
0
>>> c['a'] = 42
>>> c
ChainMap({'a': 42}, {'x': 0, 'y': 0})
>>> c.maps[0]
{'a': 42}
>>> c['y']
0
```

그렇다면 이제 본론으로 돌아가자. 우리는 `Player` 클래스의 어트리뷰트와 어노테이션을 이용하여 생성자를 숨기는 작업을 했다. 이 때 어노테이션에 쓰이는 검사 클래스들, `Contract`를 상속하는 클래스들을 직접 import시켜줬어야 했다. 지금까지 살펴본 메타클래스를 사용하여 이 문제를 해결할 방법이 쉽게 떠올르지 않는다면 이 글을 다시 읽어보도록 하자.

먼저 `Contract`를 상속하는 클래스들을 가져와야 한다. 이는 `Contract.__init_subclass__`를 오버라이드하여 쉽게 해결할 수 있다.

```python
_contracts = { }

class Contract:
    @classmethod
    def __init_subclass__(cls):
        _contracts[cls.__name__] = cls
```

```
>>> _contracts
{'Typed': <class 'Typed'>, 'Integer': <class 'Integer'>, 'Float': <class 'Float'>, 'String': <class 'String'>, 'Positive': <class 'Positive'>, 'PositiveInteger': <class 'PositiveInteger'>, 'NonEmpty': <class 'NonEmpty'>, 'NonEmptyString': <class 'NonEmptyString'>}
```

그다음은 `Base`클래스의 메타클래스가 될 `BaseMeta`클래스를 만들어주고 지금까지 했던 작업을 해주자.

```python
class BaseMeta(type):
    @classmethod
    def __prepare__(cls, *args):
        return ChainMap({}, _contracts)

    def __new__(meta, name, bases, methods):
        methods = methods.maps[0]
        return super().__new__(meta, name, bases, methods)

class Base(metaclass=BaseMeata):
    ...
```

그렇다면 끝난 것이다! 새로운 파이썬 파일을 만들고, 이 모듈에서 `Base` 클래스만을 임포트해주고, 잘 작동하는지 확인해보자.

```python
from contract import Base

class Player(Base):
    name: NonEmptyString
    x: Integer
    y: Integer

    def left(self, dx: PositiveInteger):
        self.x -= dx

    def right(self, dx: PositiveInteger):
        self.x += dx

p = Player('아드', 0, 0)
p.left(-1)
```

```
AssertionError: Must be > 0
```

억지스럽지만 마지막으로 하나만 더 해보자. `left`, `right` 메서드는 `PositiveInteger` 조건을 가지는 같은 이름을 가진 `dx` 라는 매개변수를 받는다. 이것을 클래스 바깥으로 끄집어내서 `dx`라는 이름을 가지는 매개변수는 `PositiveInteger` 조건을 가짐이 자명합니다- 라고 글로벌 변수차원에서 선언할 수 있게 만들어보자.

`checked` 에 조금의 코드만 추가하면 된다.

```python
def checked(func):
    sig = signature(func)
    ann = ChainMap(
        func.__annotations__,
        func.__globals__.get('__annotations__'), {}
    )

    @wraps(func)
    def wrapper(*args, **kwargs):
        bound = sig.bind(*args, **kwargs)
        for name, val in bound.arguments.items():
            if name in ann:
                ann[name].check(val)
        return func(*args, **kwargs)
    return wrapper
```

그렇다면 바뀐 `Player` 파일은 다음과 같다.

```python
from contract import Base, PositiveInteger

dx: PositiveInteger

class Player(Base):
    name: NonEmptyString
    x: Integer
    y: Integer

    def left(self, dx):
        self.x -= dx

    def right(self, dx):
        self.x += dx

p = Player('아드', 0, 0)
p.left(-1)
```

```
AssertionError: Must be > 0
```

짜잔! 끝!
