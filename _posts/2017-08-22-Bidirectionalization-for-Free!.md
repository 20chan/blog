---
layout: post
title: Bidirectionalization for Free!
subtitle: 이 양방향은 무료로 해줍니다
---

# Bidirectionalization for Free!

> Janis Voigtländer

## Abstract

문서나 값과 같은 원래의 소스를 받아 보여주는 함수 `get`과 반대로 보여진 값을 원래의 소스로 되돌리는 함수 `put`함수와 같은 양방향 변환은 두 기능과 관련된 특정 일관성있는 조건을 따른다.
데이터베이스와 프로그래밍 언어 커뮤니티 둘다 사용자가 기본적으로 `get` 혹은 `put` 하나만 사용할 수 있고 다른 하나는 자동으로 처리되는 기술을 배웠다.
 지금까지 양방향 작업에 대한 모든 접근들은 syntatic in nature되왔다. 반면에 제한된 표현력을 가진 특정 도메인에 특화된 언어

## 1. Introduction

우리가 다음 하스켈 함수를 작성했다고 하자:

```haskell
halve :: [a] -> [a]
halve as = take (length as `div` 2) as
```

명백하게, 이 함수의 출력은 이것의 입력된 리스트의 뒤 절반을 생략하는 추출이다. 이제 이 추출된 값을 다시 원래의 값으로 돌리고 싶다면 다음과 같이 하면 된다:

```haskell
put_1 :: [a] -> [a] -> [a]
put_1 as as` | length as` == n
             = as` ++ drop n as
                where n = length as `div` 2
```

여기서 주목해야할 점은 출력값이 되었던 ``as` ``을 원래의 `as`로 되돌리는 것은 ``as` ``의 길이가 `as`의 절반일 때만 가능하다는 것이다. 그렇지 않으면 ``as` ``와 `as`의 나머지 절반을 `halve`가 출력한 ``as` ``로 결합하는 일반적인 방법이 없기 때문이다.

다른 예를 들어보자:

```haskell
data Tree a = Leaf a | Node (Tree a) (Tree a)

flatten :: Tree a -> [a]
flatten (Leaf a) = [a]
flatten (Node t1 t2) = flatten t1 ++ flatten t2
```

이제 추상화는 입력 소스의 트리 구조를 잊게 만든다. 하지만 출력된 리스트가 어떻게 업데이트 되더라도 길이만 유지한다면, 새로운 출력은 원래의 트리로 다음과 같이 되돌릴 수가 있다:

```haskell
put_2 :: Tree a -> [a] -> Tree a
put_2 s v = case go s v of (t, []) -> t
    where go (Leaf a)   (b:bs) = (Leaf b, bs)
          go (Node s1 s2) bs   = (Node t1 t2, ds)
            where (t1, cs) = go s1 bs
                  (t2, ds) = go s2 cs
```

최종적으로, 표준 라이브러리에서 구현을 가져온 리스트에서 중복되는 원소를 제거하는 함수를 생각하자:

```haskell
rmdups :: Eq a => [a] -> [a]
rmdups = List.nub
```

적절한 되돌리는 함수는 다음과 같다:

```haskell
put_3 :: Eq a => [a] -> [a] -> [a]
put_3 s v | v == List.nub v && length v == length s`
          = map (fromJust . flip lookup (zip s` v)) s
            where s` = List.nub s
```

예를 들어, 하스켈 인터프리터에서:

```
> put_3 "abcbabcbaccba" "aBc"
"aBcBaBcBaccBa"
```

분명하게, 항상 명시적으로 함수와 역함수를 둘다 작성하는 것은 이상적인 상황이 아니다. 그래서 최근에는 양방향에 관한 많은 연구가 나오고 있다.
한가지 방법은 도메인 특화 언어를 설계하고 변환의 특정 하위 클래스에서 펜싱하여 하나의 정의만으로 순방향 및 역방향을 알 수 있게 하는 것이다.
다른 방법은 (제한된) 순방향 함수의 구문적 표현에서 작동하고, 없는 역방향 컴포넌트를 스스로 찾는 알고리즘을 고안하는 것이다.
이 