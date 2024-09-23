---
title: Covariance and Contravariance
date: 2017-12-10
description: C#의 Covariance(공변성)와 Contravariance(반공변성)에 대하여
---

## 들어가며

OOP에 대한 기본만 알고 있어도 상속이라는 개념은 잘 알고 있을 것이다. 그럼 이제 가장 간단한 부모 관계 자식을 가지는 `Pet` 클래스와 `Cat` 클래스를 다음과 같이 선언하자.

```csharp
class Pet { }
class Cat : Pet { } 
```

다음의 코드는 정상적으로 컴파일 된다. **모든 Cat는 Pet이다가 당연하기 때문이다.**

```csharp
Pet Pet = new Cat();
```

하지만 다음의 코드는 컴파일 오류를 내뱉는다. **모든 Pet가 Cat이지는 않기 때문이다.**

```csharp
Cat Cat = new Pet();
```

여기까지는 모두가 아는 당연한 사실이었다. 그렇다면 다음의 코드는 컴파일이 될까?

```csharp
void Meow(Pet Pet) { }
Action<Cat> action = Meow;
```

일단 답을 말하기 전에, C#에서 클래스가 어떤 클래스를 상속하는지 알아보려면 다음과 같이 한다.

```csharp
typeof(Cat).IsSubclassOf(typeof(Pet)) // true
```

`Action<Cat>` 타입은 `Action<Pet>` 을 상속할까? (이 주제는 언제나 재밌는 상황을 만드는데, 이 내용은 다음에 기회가 되면 얘기하도록 하자.)
아쉽게도 아니다.

```csharp
typeof(Action<Cat>).IsSubclassOf(typeof(Action<Pet>)) // false
```

그렇다면 다시 문제로 돌아와서, 위의 코드는, 멀쩡하게 컴파일이 된다.

## 왜?

위와 같은 상황이 언제 벌어지는지를 간단한 예제를 들어 생각해보자.

```csharp
void Feed(Pet pet) { ... }

Cat cat = ...;
Feed(cat);
```

위의 코드는 정상적으로 컴파일 되는 코드이다. 그렇다면 먹이를 주는 메서드를 반환하는 메서드 `GetFeeder` 를 생각해보자.

```csharp
Action<Pet> GetFeeder() { ... }

Cat cat = new Cat();
Action<Cat> catFeeder = GetFeeder();
catFeeder(cat);
```

헷갈리지 말자. `GetFeeder` 는 `Action<Pet>` 타입의 변수가 아닌 `Action<Pet>` 타입을 반환하는 메서드이다.
여기서 `Action<Pet>` 타입은 `Action<Cat>` 타입으로 변환된다. 하지만 문제가 생길 일은 없어 보인다. 오히려 다음의 코드는 컴파일 오류가 난다.

```csharp
Action<Cat> GetCatFeeder() { ... }

Pet dog = ...;
Action<Cat> catFeeder = GetCatFeeder();
Action<Pet> petFeeder = catFeeder; // 컴파일 오류!
petFeeder(dog);
```

`GetCatFeeder()` 의 반환값인 `catFeeder`는 고양이에게 먹이를 주는 메서드인데, 이를 모든 애완동물에게 먹이를 줄 수 있는 메서드인 `petFeeder`로 변환은 당연히 안된다.


처음 생각했던 것과는 정반대의 결과이다! 더 작은 타입을 더 큰 타입으로 변환은 안되지만, 더 큰 타입을 더 작은 타입으로 변환은 가능하다.


그렇다면 다른 경우를 알아보자. Pet의 리스트에 먹이를 주는 `FeedAll` 메서드를 만들어보고 사용해보자.


```csharp
void FeedAll(IEnumerator<Pet> pets) { ... }

IEnumerator<Cat> cats = ...;
FeedAll(cats);
```

이 코드도 아무 컴파일 에러가 없으며, 문제 생길 일이 없다. 하지만 방금의 결과랑 또 다르지 않는가? 반대의 경우를 생각해보자.

```csharp
void FeedAllCats(IEnumerator<Cat> cats) { ... }

IEnumerator<Pet> pets = ...;
FeedAllCats(pets); // 컴파일 오류!
```

고양이에게 먹일 먹이를 아무 애완동물에게 먹이면 안되는 것과 같다. 하지만 어라? 아까의 경우와 정반대의 결과가 아닌가? 하지만 문맥은 비슷함을 알 수 있다. 고양이에게 먹일 수 있는 먹이를 모든 애완동물에게 줄 수 없지만 모든 애완동물이 먹을 수 있는 먹이는 고양이도 먹을 수 있다는 것이다.


이를 컴파일러는 어떻게 처리했길래 각자 경우를 처리할 수 있는걸까?


아무도 신경쓰지 않았겠지만, `Action<T>` 이나 `IEnumerator<T>` 는 그냥 제너릭 클래스가 아니다. 두 클래스의 정의를 보면 다음과 같다.

```csharp
public delegate void Action<in T>(T obj);
```

```csharp
public interface IEnumerator<out T> : IDisposable, IEnumerator
```

`Action` 클래스의 T 앞에는 `in` 키워드가, `IEnumerator` 클래스의 T 앞에는 `out` 키워드가 있음을 알 수 있다. 이 두 키워드가 큰 타입을 작은 타입으로 변환할 수 있게 하거나 작은 타입을 큰 타입으로 변환할 수 있게끔, 즉, 공변성(Covariance)과 반공변성(Contravariance)을 결정하는 것이다.

## 공변성과 반공변성과 불변성

공변성은 더 작은 타입을 큰 타입으로 변환할 수 있게 해준다.
반공변성은 더 큰 타입을 더 작은 타입으로 변환할 수 있게 해준다.
불변성은 둘 다 안됨.

`in` 키워드를 사용하여 타입을 공변으로 만들고, `out` 키워드를 사용하여 타입을 반공변으로 만들고 둘 다 사용하지 않으면 불변이다. 다음의 예제로 각 성질을 다시 확인할 수 있다.

```csharp
interface Covariance<in T> { }      // 공변성
interface Contravariance<out T> { } // 반공변성
interface Invariance<T> { }         // 불변성

static void Main(string[] args)
{
    Covariance<Cat> cocat =         (Covariance<Pet>)null; // 컴파일 됨
    Covariance<Pet> copet =         (Covariance<Cat>)null; // 컴파일 오류!

    Contravariance<Cat> concat =    (Contravariance<Pet>)null; // 컴파일 오류!
    Contravariance<Pet> conpet =    (Contravariance<Cat>)null; // 컴파일 됨

    Invariance<Cat> incat =         (Invariance<Pet>)null; // 컴파일 오류!
    Invariance<Pet> inpet =         (Invariance<Cat>)null; // 컴파일 오류!
}
```

## 참고한 링크

https://stackoverflow.com/questions/1078423/c-sharp-is-variance-covariance-contravariance-another-word-for-polymorphis/1078469#1078469
https://stackoverflow.com/questions/3445631/still-confused-about-covariance-and-contravariance-in-out
