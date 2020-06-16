---
layout: post
title: Opening Mail Server
subtitle: 15시간 삽질기
---

아무리 이상하고 쓸데없는걸 많이 하는 프로그래머들에게도 '그걸 왜해' 하는 일들이 있다. 메일 서버가 그중 하나일만큼 정말 쓸데없고 귀찮다.

계기는 간단했다. 최근에 시작한 [탈구글하기](https://nomoregoogle.com/) 프로젝트에서 맘에 드는 메일 클라이언트가 없었고, 기존에 쓰는 구글 계정이나 그쪽으로 포워딩해둔 커스텀 도메인 이메일들을 쓰기 싫어져서 아예 메일 서버를 새로 만들자고 생각했던건데 사실 다 핑계고 그냥 간지나보였다.

사실상 메일 서버가 아니라 메일 서비스를 통째로 만드는 거니까 메일 서버, 메일 클라이언트가 필요했고 메일 서버가 단순히 메일을 받고 보내기만 가능한 것 뿐만 아니라 계정 보안, 스팸 필터링 등의 복잡한 부가 기능이 필요했다.

내가 실제로 사용하기 위해 원했던 최소한의 기준은 다음과 같다:
- 보안 로그인
- 상식적인 메일 송수신
- 메일 필터링과 편지함 관리
- 스팸 필터링
- 10초 이내의 메일 알림

그리고 결론적으로 IMAP과 SMTP, 인증서, SPF, DKIM 등을 지원하는 보안 이메일 서비스를 만들었다.

## 준비

메일서버는 [tomav/docker-mailserver](https://github.com/tomav/docker-mailserver)와 웹 클라이언트는 [rainloop](https://github.com/RainLoop/rainloop-webmail)을 사용하기로 했다. 인증서는 letsencrypt, 리버스 프록시는 서버에 붙어있는 nginx을 그대로 쓰기로 했다. 이건 좀 후회가 많이 되는 부분임

저 메일 서버는 IMAP와 SMTP기반 메일 송수신과 파일시스템으로 계정-메일을 관리하는 방식과 스팸 필터링, 로그인 밴같은 기본적인 기능부터 dkim, ssl, spf 등의 보안 설정과 릴레이 등도 전부 도커 이미지 하나로 쉽게 돌릴 수 있어서 세상 참 좋아졌구나 느꼈다

암튼 [만든 사람의 취지](https://tvi.al/simple-mail-server-with-docker/)에도 잘 맞고 클라이언트는 무난하게 아무거나 골랐다.

메일서버를 구동할 서버는 기존 여러 도메인과 여러 마이크로 서비스를 붙여서 괴롭히고 있던 aws lightsail 인스턴스에다 올리고, 도메인은 큰그림을 그리고 샀던 도메인 하나를 사용하기로 했다. 여기에서 좀 몇가지 문제가 생겼지만 이거는 나중에 말하는걸로

메일 클라이언트 웹 호스트는 `mail.{domain}`를 사용하기로 했고, 그리고 smtp 서버도 `mail.{domain}`을 사용하기로 했다.

그리고 아티클이 정말 찾기 힘들다. 완전 같은 기술스택을 사용한는 글은 못찾았고, 대신 가장 비슷한 [docker-mailserver + rainloop + caddy에 self-cert 사용한 글](https://medium.com/minds-in-the-cloud/spin-off-an-email-server-with-containers-using-docker-compose-on-google-cloud-platform-debian-9-aa0fe8bf3d88)이 유일한 from scratch 블로그 포스트였다. 이 글과 mail-server 리포 readme와 위키를 가장 많이 참고했고, 대부분의 SMTP나 서버 문제는 정말 제대로 된 글 찾기도 힘들고 웹삽질도 많이 햇다.

## 설치

설치와 설정은 정말 정말 간단하다. 오랜만에 docker와 docker-compose 뽕을 제대로 받았다.

```shell
$ docker pull tvial/docker-mailserver
$ docker pull hardware/rainloop

$ curl -o setup.sh https://raw.githubusercontent.com/tomav/docker-mailserver/master/setup.sh
$ chmod a+x ./setup.sh
$ curl -o docker-compose.yml https://raw.githubusercontent.com/tomav/docker-mailserver/master/docker-compose.yml.dist
$ curl -o .env https://raw.githubusercontent.com/tomav/docker-mailserver/master/.env.dist
```

도커에서 이미지를 받고, 리포의 강력추천 스크립트와 설정파일도 받아준다. 가장 기본적인 설정만 하기 위해 `.env`파일을 수정하자

```env
HOSTNAME=mail
DOMAINNAME=0ch.me
CONTAINER_NAME=mail
```

그리고 rainloop을 서비스로 돌리기 위해 `docker-compose.yml` 파일을 수정해준다


```yml
version: '2'
services:
  rainloop:
    container_name: rainloop
    image: hardware/rainloop:latest
    restart: always
    links:
    - mail
    ports:
    - "6001:8888"
    volumes:
    - rainloop_data:/rainloop/data
  mail:
  # ...
volumes:
# ...
```

nginx 설정도 간단하다

```nginx
server {
    server_name mail.{domain}

    location / {
        proxy_pass http://localhost:6001;
    }

    # ...letsencryptstuffs
}
```

근데 이걸 caddy 사용해서 프록시와 인증서 관리하는거 보고 caddy괜찮은데?? 하고 찾아보니 역시 다들 nginx에서 caddy로 갈아타고 그걸 자랑하더라. 나도 언젠가 그래야지

그럼 이제 아마 적어도 돌아는 가는 상황은 됐을거다 `docker-compose up`으로 전부 실행해주면 서버도 시작은 되고, 클라이언트도 시작은 된다.
하지만 중요한 DNS 설정을 아직 말 안했다 사실 이게 제일 중요함

```
mail    A   {ip}
@       MX  10 mail.{domain}
```

그리고 서버 인증서는 다른 도메인 인증하는데 썼던거처럼 letsencrypt를 그대로 쓰기로 했다.
근데 여기서 실수해서 경로를 글로벌로 잡아버려서 무시무시한 짓을 하게 되었다 아무튼

```shell
$ certbot certonly --standalone -d mail.{domain}
```

로 인증서를 발급받고, 이 글로벌 루트 경로인 `/etc/letsencrypt/` 경로를 그대로 docker에 넘겨버리기로 했다.

이제 슬슬 테스트를 해볼 시점이다. 이메일 계정으로 사용할 유저 계정을 넣자

```shell
$ sudo ./setup.sh email add {username}@mail.{domain} {password}
```

그리고 실행

```shell
$ sudo docker-compose up -d
Starting mail … done
Starting rainloop … done
```

그렇게 이메일 클라이언트 rainloop를 실행할 수 있게되었다.
그런데 여기서 바로 들어가서 위에 넣었던 유저 계정으로 로그인하면 `domain is not allowed` 에러가 뜬다. 여기서 좀 헤맸지만, 아직 rainloop 설정을 안해서 그렇다. `mail.{domain}?admin` 으로 들어가 rainloop 어드민 판넬에 로그인하자. 초기 아이디 비밀번호는 `admin` `12345` 이다.

들어가 바로 어드민 비밀번호를 수정하고, 도메인을 추가해준다.

![rainloop-admin](/img/rainloop-admin.png)

사진은 gmail이지만 아무튼 이런식으로 넣어주고 Test를 눌렀을 때 둘다 초록색으로 나오면 ok
이제 다시 추가했던 계정으로 로그인하면 로그인 성공 후 빈 메일함이 나와줘야 한다.

## 하지만

물론 여기까지 순탄하게 오질 않았다. SMTP서버가 작동하지 않아 온갖 삽질을 다 했다.

### user not found

분명 위 도메인을 추가하고 로그인을 해도 로그인이 안되서 삽질을 했는데, 다음처럼 수동으로 로그인을 해서 테스트를 해보면 분명 로그인이 됐다

```
$ sudo ./setup.sh email list
$ sudo ./setup.sh debug login

# get inside docker shell
$ doveadm auth login {email} {password}
```

그런데 여기서 로그를 보니 `doveadm`을 이용해 로그인할 때 패스워드가 틀렸을 때는 분명 유저 이름이 도메인 이름을 포함한 풀 이메일 `username@domain`으로 나오는데, rainloop 에서 로그인을 하면 `username`으로만 나오고 user not found 에러가 나더라고

그래서 보니까 rainloop admin 도메인 설정에서 `Use short login` 옵션이 켜져있었다. 이걸 꺼야 하는데 이거때문에 멍청하게 얼마나 삽질을 했는지

### Could not connect to SMTP host

smtp 연결이 잘 안되더라. 분명 제대로 설정을 한 것 같은데 포트, ssl, starttls 등 하나하나 바꿔가면서 테스트를 해보는데 계속 테스트가 실패해서

일단 기존에는 텔넷으로 이렇게 테스트를 했다. 포트는 너무 많은 포트에 너무 많은 테스트를 해서 까먹었다

```shell
$ telnet mail.{domain} {port}
```

그러면 STARTTLS 이후 `SMTP Error: Could not connect to SMTP host` 라는 에러와 함께 깨진 유니코드같은 텍스트가 나오더니 죽고, 서버에서는 이렇게 TLS 버젼 에러가 난다

```log
Jun 16 03:25:21 mail postfix/smtps/smtpd[9341]: SSL_accept error from unknown[{ip}]: -1
Jun 16 03:25:21 mail postfix/smtps/smtpd[9341]: warning: TLS library problem: error:1408F10B:SSL routines:ssl3_get_record:wrong version number:../ssl/record/ssl3_record.c:332:
Jun 16 03:25:21 mail postfix/smtps/smtpd[9341]: lost connection after CONNECT from unknown[{ip}]
```

이게 서버 문제인줄 알고 서버에서 `TLS_LEVEL`을 modern에서 intermediate로 바꿨는데 좀만 찾아보니 사실 이게 텔넷 클라이언트 문제더라고
다음처럼 openssl로 접속하면 인증까지는 잘 되더라

```shell
$ openssl s_client -crlf -connect mail.{domain}:{port}
```

이후에는 포트삽질좀 하다 위키에서 [포트 문서](https://github.com/tomav/docker-mailserver/wiki/Understanding-the-ports) 읽고 또 삽질해서 맞는 포트 전부 잘 맞춰주니까 메일 수신은 성공했다. 내부 계정 -> 내부 계정도, 지메일 -> 내부 계정도 잘 됐다.

![smtp works](/img/smtp-works.png)

너무 기뻐서 처음 메일 왔을 때 스크린샷 찍어뒀다

## 추가

### SPF

DNS에 다음 softfail spf를 추가한다.

```DNS
@   TXT "v=spf1 mx ~all"
```

테스트하는 도중에는 이렇게 쓸 수 있고 나중에 이를 hardfail spf로 바꿔야 한다는 것 같음 자세한건 [위키](https://github.com/tomav/docker-mailserver/wiki/Configure-SPF)


### dkim

```shell
$ sudo ./setup.sh config dkim
```

그러면 dkim 키가 `config/opendkim/keys/{domain}/mail.txt`에 생성된다. 이걸 적당히 DNS에 추가해준다. 역시 자세한건 [위키](https://github.com/tomav/docker-mailserver/wiki/Configure-DKIM)

```DNS
mail._domainkey TXT "v=DKIM1; h=sha256; k=rsa; p=...."
```

### SPAMASSASSIN

environment에서 적당히 `ENABLE_SPAMASSASSIN=1` 을 넣어주면 작동한다.

## 25

로그인, 메일 받기, 스팸 필터링 등도 다 되는데 아직 제일 중요한 메일 보내는게 안된다.
도대체 문제가 뭘까? 하루종일 로그만 들이다 보았다. 매번 같은 문제였다.

```log
Jun 16 03:19:06 mail postfix/smtp[8064]: connect to gmail-smtp-in.l.google.com[2404:6800:4008:c07::1b]:25: Cannot assign requested address
Jun 16 03:19:36 mail postfix/smtp[8064]: connect to gmail-smtp-in.l.google.com[74.125.203.27]:25: Connection timed out
Jun 16 03:19:36 mail postfix/smtp[8064]: connect to alt1.gmail-smtp-in.l.google.com[2607:f8b0:4003:c10::1b]:25: Cannot assign requested address
...
```

다른 메일 서버의 smtp에 연결하려고 하면 cannot assign requested address..이후 time out에러가 떠서 결국 외부 메일 서버로 메일이 보내지지 않는다

이 문제는 나름 흔했던 것 같다 비슷한 문제를 겪는 이슈가 [1](https://github.com/tomav/docker-mailserver/issues/1524) [2](https://github.com/tomav/docker-mailserver/issues/1490) [3](https://github.com/tomav/docker-mailserver/issues/1127) [4](https://github.com/tomav/docker-mailserver/issues/854) [5](https://github.com/tomav/docker-mailserver/issues/771) [6](https://github.com/tomav/docker-mailserver/issues/598) [7](https://github.com/tomav/docker-mailserver/issues/234) [8](https://github.com/tomav/docker-mailserver/issues/150) 이렇게나 많았다.

하지만 정말 단순하고 근본적인 문제였다. 로컬에서는 메일서버 25포트로 연결이 되는데, 인스턴스 안에서는 자기 자신으로는 물론 outbound 25포트가 전부 안됐다. 그제서야 이게 저 많은 이슈들에서 말했던 근본적으로 어쩔 수 없는 문제라는 말이 이해가 됐다.
AWS는 EC2와 라이트세일에서 outbound [25포트를 막아놨다](https://aws.amazon.com/premiumsupport/knowledge-center/ec2-port-25-throttle/).

수많은 삽질 끝에 내잘못이 아니란걸 깨닫고 너무 해탈했지만 아무튼 멍청했던건 사실이고.. 저기 나와있는대로 이메일 전송 제한 제거 요청 양식을 제출하고 기다리는 중이다. 보통 48시간정도 걸린다고 하니 천천히 기다리다 승인받으면 쓰고 아니면 릴레이 서버를 알아봐야겠다.

사실 릴레이서버도 이미 무료 smtp서버 [sendgrid](https://sendgrid.com)를 알아보고 설정해봤는데 작동하지 않아서 일단 AWS탓을 하면서 기다리는 중이다.

AWS에서 답장이 오면 이어서 작업하고 글을 마무리해야겠다

+ 06/16
하지만 답장이 오기 전 왜 릴레이가 안되지부터 다시 잡아보았다

## 릴레이

분명 DEFAULT_RELAY_HOST, RELAY_HOST, 그리고 setup.sh 에서 relay까지 전부 넣었는데 막상 도커 컨테이너 안에 들어가서 검색하면 안나오는거임
비슷한 이슈를 찾아봐도?? 딱히 없고

그래서 혹시나 해서 `docker-compose restart`로 서버를 재시작하던걸 다시 `docker-compose down && docker-compose up -d` 로 내렸다 다시 올렸더니 이제서야 relay 호스트가 등록이 되었더라고 진짜 개당황스럽지만 됐다는 기쁨이 더 크다

암튼 그래서 이제 정말로 릴레이로 바로 이어지는데? 내가 사용한 릴레이서버 sendgrid에서 이렇게 응답이 온다

```log
Jun 16 05:56:24 mail postfix/smtp[1631]: Trusted TLS connection established to smtp.sendgrid.net[161.202.148.182]:587: TLSv1.2 with cipher ECDHE-RSA-AES256-GCM-SHA384 (256/256 bits)
Jun 16 05:56:25 mail postfix/smtp[1631]: EAE0B84DE57: to=<{}@gmail.com>, relay=smtp.sendgrid.net[161.202.148.182]:587, delay=1.1, delays=0/0/0.83/0.23, dsn=5.0.0, status=bounced (host smtp.sendgrid.net[161.202.148.182] said: 550 The from address does not match a verified Sender Identity. Mail cannot be sent until this error is resolved. Visit https://sendgrid.com/docs/for-developers/sending-email/sender-identity/ to see the Sender Identity requirements (in reply to end of DATA command))
Jun 16 05:56:25 mail postfix/cleanup[1630]: 0798784DE58: message-id=<20200616055625.0798784DE58@mail.{domain}>
Jun 16 05:56:25 mail postfix/bounce[1642]: EAE0B84DE57: sender non-delivery notification: 0798784DE58
```


그래서 sendgrid에서 일단 도메인 DNS verification을 해봤다 거기서 말한대로 CNAME DNS 몇개 추가하고 나니까 바로 도메인 verification이 끝나고, 그리고 다시 이메일을 보내보니??

![email sent successfully](/img/smtp-relay.png)

그리고 릴레이서버에서도 로그를 확인할 수 있었다

![free 1/100](/img/sendgrid-activity.png)

성공적으로 메일 받기, 보내기까지 끝냈다 정말 대단해~~!!!!

### Reverse DNS

남은 하나는 SMPTD 배너다
dns reverse lookup 호스트가 일치하지 않아 여러곳에서 경고를 보내는데 이것도 aws ec2제한이더라고
이거 역시 email send request 답장이 오면 볼 수 있겠다

## 끝?

일단 aws 문제 이후 정말 마지막을 볼 수 있겠지만
그래도 나름 메일 송수신이 되는 메일 서버를 다 만들고 나니 너무 감개무량하다

docker-mailserver 라는 완전 편리한게 있어서 이정도 삽질로 끝난게 다행이지 아니었으면 얼마나 고생했을지 끝은 볼 수 있었는지 상상도 안간다

탈구글에 한발자국 다가간 것 처럼 느껴지지만 그래도 아직은 아니다 정말로 이걸 실사용할 수 있을지는 두고 봐야지