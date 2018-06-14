---
layout: post
title: String Interning
subtitle: C#의 string.Intern
---

## 들어가며

C#의 `string.Intern` 이라는 메서드는 문자열 풀에서 문자열을 풀링시켜 메모리를 아끼고 메모리 비교를 더 빠르게 해준다. 쓰는건 정말 간단하다. `a = string.Intern("this is string")` 으로 문자열을 넘기면 끝이다.

간단하게 퍼포먼스 비교를 해보자.

```csharp
string a = "dolphin";
string b = "dol";
b += "phin";
bool res = false;
var sw = new Stopwatch();

sw.Start();
for (int i = 0; i < 100000000; i++)
    res = a == b;
sw.Stop();
Console.WriteLine("Before intern:");
Console.WriteLine(sw.ElapsedMilliseconds);
b = string.Intern(b);

Console.WriteLine("After intern:");
sw.Reset();
sw.Start();
for (int i = 0; i < 100000000; i++)
    res = a == b;
sw.Stop();
Console.WriteLine(sw.ElapsedMilliseconds);
```

```
Before intern:
1920
After intern:
429
```

`string.Intern` 으로 받은 문자열은 문자열이 같다면 같은 문자열을 참조하게 되어 `ReferenceEquals` 메서드를 사용하여 비교해도 결과값이 참이 된다.

문자열을 인터닝하여 사용하면 이렇게 성능의 향상을 볼 수 있지만 `Intern` 메서드는 매우 느리다. 조심해서 쓸 필요가 있다.

## 멀티스레딩

하지만 여러개의 스레드에서 `string.Intern`은 사용할 수 있을까? 일단 `string.Intern` 은 스레드 안전한 메서드이다.

우선 `ConcurrentDictionary`를 사용해서 직접 스레드 안전한 `Intern` 메서드를 만들어보자.

```csharp
static ConcurrentDictionary<string, string> dic = new ConcurrentDictionary<string, string>();
static string Intern(string str)
    => dic.GetOrAdd(str, String.Copy);
```

그리고 100개의 스레드에서 테스트를 해보자.

```csharp
ConcurrentDictionary<string, string> dic = new ConcurrentDictionary<string, string>();
string Intern(string str)
    => dic.GetOrAdd(str, String.Copy);
var s = Intern("i am very cool string");
void NewIntern()
{
    bool a;
    for (int i = 0; i < 100000; i++)
    {
        var ss = Intern("i am very cool string");
        a = s == ss;
    }
}
void StringIntern()
{
    bool a;
    for (int i = 0; i < 100000; i++)
    {
        var ss = string.Intern("i am very cool string");
        a = s == ss;
    }
}

var sw = new Stopwatch();
Thread[] threads = new Thread[100];
for (int i = 0; i < threads.Length; i++)
    threads[i] = new Thread(NewIntern);

sw.Start();
foreach (var t in threads)
    t.Start();
foreach (var t in threads)
    t.Join();

sw.Stop();
Console.WriteLine($"With NewIntern: {sw.ElapsedMilliseconds} ms");

threads = new Thread[100];
for (int i = 0; i < threads.Length; i++)
    threads[i] = new Thread(StringIntern);

sw.Reset();
sw.Start();
foreach (var t in threads)
    t.Start();
foreach (var t in threads)
    t.Join();

sw.Stop();
Console.WriteLine($"With string.Intern: {sw.ElapsedMilliseconds} ms");
```

```
With NewIntern: 2550 ms
With string.Intern: 3943 ms
```

## 결론

1. 꼭 필요할 때 아니면 쓰지 말자
2. 꼭 필요하고 많은 스레드에서 돌아가면 직접 만들어 쓰자

## 참고

https://stackoverflow.com/questions/6983714/locking-on-an-interned-string?utm_medium=organic&utm_source=google_rich_qa&utm_campaign=google_rich_qa