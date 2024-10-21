---
title: Make Typescript Typescriptly
date: 2024-10-21
description: 타입스크립트를 타입스크립트스럽게 사용하기
---

타입스크립트는 굉장히 강력하고, 유연한 타입 시스템을 가지고 있다.
하지만 이걸 잘 활용하지 못하고 자바스크립트 스럽게, 혹은 타입스크립트 스럽지 않은 해결 방법을 자주 보는 편이다.
타입스크립트에서만 가능한 유용하고, 내가 자주 사용하는 패턴들을 모아보았다.

## use strict

세상에. 나는 strict하지 않아 null/undefined 타입을 분류하지 않는 경우를 보기 전까지 믿지 않았다.
모든 데이터는 명시적으로 nullable 하지 않으면 nullish 하지 않아야 하거늘

## Union

조금 마음에 안들지만 다음과 같이 자주 사용되곤 한다.

```ts
function f(value: string | number) {
  if (typeof value === 'string') {
  } else {
  }
}
```

명시적으로 rest parameter를 확인하지 않아도 되는 유용한 패턴도 있다.

```ts
function insertValueOrValues(value: string | string[]) {
  if (typeof value === 'string') {
    value = [value]
  }
}
```

하지만 진가는 다른 곳에서 나타난다. 일반적인 OOP에서는 상속으로만 해결할 수 있는 구조를 다음과 같이 설계가능하다.

```ts
interface Dog {
  type: 'dog';
  bark: () => {};
}

interface Cat {
  type: 'cat';
  meow: () => {};
}

type Animal = (
  | Dog
  | Cat
)
```

이렇게 `Animal` 타입이 정의된 경우, `Animal` 타입의 값의 type을 비교할 시 컴파일러는 알아서 `Dog` 혹은 `Cat` 타입으로 추론된다. 그래서 다음과 같이 사용 가능하다.

```ts
function makeSound(animal: Animal) {
  if (animal.type === 'dog') {
    animal.bark();
  } else if (animal.type === 'cat') {
    animal.meow();
  }
}
```

## Utility Types

타입스크립트의 utility type은 굉장히 자주 쓰인다. 이건 구현이 안될 것 같은데 필요하다 싶으면 대부분 있다. [TS Docs/Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html)

가장 많이 쓰는걸 추려보려 했는데 대부분 많이 사용한다.

간단하게, 꽤나 꼬여있는 상황을 예시로 들어보자.
다음과 같이 라이브러리에서 함수의 파라미터 타입이 export되지 않아 귀찮은 경우가 있다.

```ts
interface ExValue {
}

interface ExType {
  fields: ExValue[];
}
export function f(value: ExType) {}
```

이 경우 파라미터의 타입을 가져오고 싶은 경우, `Parameters<typeof f>[0]`로 `ExType`, `Parameters<typeof f>[0]['fields'][0]`로 `ExValue` 타입을 가져올 수 있다.
물론 이런 경우 주로 라이브러리의 잘못이 맞다.

## assertion

꽤 귀찮고 가장 많이 사용하는 유용한 예시가 바로 하나 있다.

```ts
function isNonNullish<T>(value: T | null | undefined):
  value is NonNullable<typeof value> {
  if (x === null || x === undefined) {
    return false;
  }
  return true;
}

function throwIfNullish<T>(value: T):
  asserts value is NonNullable<T> {
  if (x === null || x === undefined) {
    throw {};
  }
}

const items: Array<string | null> = [];
const filtered = items.filter(isNonNullish); // string[]

const item: string | null = null as any;
throwIfNullish(item);
item // string
```

`items.filter(x => x !== null)` 로는 타입이 바뀌지 않는데 ([Typescript 5.5의 Inferred Type Predicates](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-5.html#inferred-type-predicates)에서 고쳐진다) `items.filter(isNonNullish)` 혹은 `items.filter((x): x is string => x !== null)` 처럼 사용했었다.

## as const

비교적 큰 데이터를 코드로 넣었을 때 `as const`로 값을 넣으면 데이터를 컴파일 단위에서 검증할 수 있다.
다음과 같은 데이터가 있을 때

```ts
const data = [
  {
    type: 'dog',
    birth: '2024-01',
  },
  {
    type: 'cat',
    birth: '2024-01',
  },
];
```

이 때 `data`는 `Array<{ type: string; birth: string; }>` 타입으로 추론된다.
하지만 데이터를 `as const`로 선언 시 타입은 데이터 그대로의 값이 들어가지며, 똑똑하게 `data[0].type` 는 `dog`으로 타입이 추론된다.

## \`\${number}-${number}\`

[Template Literal Types](https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html)는 inference 사용을 제외하면 사용할 일이 그렇게 많지는 않지만, 어느정도 실수를 방지할 수 있다.

```ts
type DateFormat = `${number}-${number}-${number}`
type RedisKeyFormat = `${string}:${string}:${string}`;
```

물론, 욕심내서 더 멋있게 만드는 것도 가능하다.

## schema

어떻게 보면 over engineering이라 볼 수 있지만, 스키마를 타입으로 넘겨 바뀌는 타입을 동적으로 생성하는 것도 편리하고 기분좋다.

가장 쉽고 자주 보이는 예시를 들자면, 오브젝트의 snake_case 변수명을 camelCase로 바꾸는 `toCamelCaseObject` 함수를 type safe 하게 선언할 수 있다.

```ts
type ToCamelCase<T extends string> = (
  T extends `${infer X}_${infer XS}`
  ? `${X}${Capitalize<ToCamelCase<XS>>}`
  : T
)

type ToCamelCaseObject<T> = {
  [K in keyof T as K extends string ? ToCamelCase<K> : K]: T[K]
}

function toCamelCaseObject<T>(value: T): ToCamelCaseObject<T> {}
```

`toCamelCase<'is_odd'>` 는 `'isOdd'` 타입으로, `toCamelCaseObject` 함수는 데이터를 해당 타입에 맞게 잘 뽑아낼 수 있다.
레거시 sql 쿼리와 붙어있는 코드에서 유용하게 사용했다.

비슷하게 validation 류의 함수에도 잘 사용한다.

```ts
const data = validate(input, {
  name: {
    type: 'string',
    required: true,
  },
  age: {
    type: 'number',
    required: false,
  },
});
```

이렇게 검증할 데이터와 스키마를 값으로 넘기는 경우(요즘은 대부분 잘만든 스키마 validation 라이브러리를 사용하겠지만)
해당 함수의 리턴 타입을 스키마에 맞는 타입으로 뽑을 수 있다. 역시 기분이 좋다.

최근에는 query string을 스키마로 뽑기 위해 만들어 쓰기도 했다. [nextjs-parser/NextProps.ts](https://github.com/20chan/nextjs-parser/blob/main/src/NextProps.ts)

## 기타

대부분은 나의 괴짜 직장 선배님 [if1live](https://if1live.github.io/) 님과 일하며 배웠다. 샤라웃

그리고 대부분 [TS Docs/Cheat Sheets](https://www.typescriptlang.org/cheatsheets/)에서 볼 수 있다. 물론 어떻게 쓰는지, 좋게 쓰는 법 등은 자세하진 않지만

[타입 레벨 틱택토](https://note89.github.io/typescript-typelevel-tic-tac-toe/) 같은 거나 누가 더 만들어줬으면 좋겠다.
