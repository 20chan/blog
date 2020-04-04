---
layout: post
title: .Net Method Hijacking
subtitle: 메서드 밑장빼기
---

계기는 단순했다. 유니티에서 시스템 프로퍼티 값을 바꿔주는 시뮬레이터를 만들고 싶었고 하위단에서 그거 하나 래퍼 만들기 귀찮아서 하려고 했다.

coreclr(이제는 [.NET Runtime](https://github.com/dotnet/runtime/)으로 이미지 세탁한거 같음)에서 런타임에 메서드 정보를 가지고 있는 메서드 디스크립터란게 있다. 이 메서드 디스크립터는 Jit 컴파일러가 메서드를 머신 코드로 컴파일한 주소를 가지고 있다. 이 메서드 디스크립터와 함께 런타임에서 돌아가는 이상한걸 언젠가 모아서 포스팅을 해보고 싶은데, 암튼 이론상 이 주소를 다른 메서드의 주소로 바꿔치울 수 있다면 메서드를 통째로 바꿀 수 있다는 것

## MethodDesc

.net runtime 코드에서 [MethodDesc 클래스의 정의](https://github.com/dotnet/runtime/blob/0e06be71fe8d752e88c75e62c7387f01526b6498/src/coreclr/src/vm/method.hpp)를 보자.

보지말자 잇힝귀찮앙

## 짜잔

[깃헙](https://github.com/20chan/hijacs)에 성공한 코드를 올렸다 프로젝트 이름은 hijack에 csharp 대충 합쳐서 hijacs임 발음은 하이재쉬로 읽어야 간지가 난다