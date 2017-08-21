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