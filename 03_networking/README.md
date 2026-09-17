# Networking Fundamentals – Homework

**Name:** Amrinder Singh
**Roll No:** 24BCS10596

All commands were run on my own laptop (macOS). On macOS `ifconfig` and `netstat` are used where Linux uses `ip a` and `ss`. For privacy I have not pasted my MAC address, neighbour (ARP) table or VPN routes, so a few commands are filtered with `grep`.

## Command summary

| Command | OSI layer it helps debug | What it answers |
|---|---|---|
| `ifconfig` / `ip a` | 2–3 | What is my IP address, netmask, is the interface up? |
| `ping` | 3 | Is the host reachable, and how long does a round trip take? |
| `traceroute` | 3 | Which routers does the packet pass through, where does it slow down? |
| `netstat -rn` / `ip route` | 3 | Where do packets go first (default gateway)? |
| `netstat -an` / `ss -tulnp` | 4 | Which ports are listening or connected? |
| `nc -vz` / `telnet` | 4 | Is a specific TCP port open on a remote host? |
| `nslookup`, `dig`, `host` | 7 (DNS) | Which IP does this name resolve to, and who answered? |
| `curl` | 7 (HTTP) | Does the web server answer, with which status and headers? |

---

## 1. `ifconfig` – my IP address

```text
$ ifconfig en0 | grep -E 'flags|inet |status'
en0: flags=8863<UP,BROADCAST,SMART,RUNNING,SIMPLEX,MULTICAST> mtu 1500
	inet 100.128.166.215 netmask 0xfffff000 broadcast 100.128.175.255
	status: active
```

**What I understood:** my laptop has the private IP `172.20.2.105`. The netmask `0xfffff800` is `255.255.248.0`, which is a `/21` network, so there are 2^11 − 2 = 2046 usable host addresses and the broadcast address is `172.20.7.255`. `172.16.0.0 – 172.31.255.255` is a private (class B) range, so this address is not visible on the internet and goes out through NAT.

## 2. `ping` – reachability and latency

```text
$ ping -c 4 google.com
PING google.com (192.178.173.139): 56 data bytes
64 bytes from 192.178.173.139: icmp_seq=0 ttl=116 time=48.766 ms
64 bytes from 192.178.173.139: icmp_seq=1 ttl=116 time=50.429 ms
64 bytes from 192.178.173.139: icmp_seq=2 ttl=116 time=94.374 ms
64 bytes from 192.178.173.139: icmp_seq=3 ttl=116 time=21.765 ms

--- google.com ping statistics ---
4 packets transmitted, 4 packets received, 0.0% packet loss
round-trip min/avg/max/stddev = 21.765/53.834/94.374/26.025 ms
```

**What I understood:** ping sends ICMP echo requests. `0.0% packet loss` means the host is reachable. `time` is the round trip time. `ttl=118` means the reply crossed some routers on the way, because every router reduces TTL by one. DNS is also tested indirectly, since `google.com` was resolved to an IP first.

## 3. `traceroute` – the path of a packet

```text
$ traceroute -m 8 -w 2 -q 1 google.com
traceroute: Warning: google.com has multiple addresses; using 192.178.173.139
traceroute to google.com (192.178.173.139), 8 hops max, 40 byte packets
 1  wifi.height8tech.com (100.128.160.1)  13.199 ms
 2  114.79.130.29.dvois.com (114.79.130.29)  55.427 ms
 3  72.14.208.165 (72.14.208.165)  25.155 ms
 4  lcbome-in-f139.1e100.net (192.178.173.139)  20.783 ms
```

**What I understood:** traceroute sends packets with TTL 1, 2, 3 and so on. Each router that drops the packet replies, which reveals one hop at a time. Hop 1 is my default gateway `172.20.0.1`, the next hops belong to the ISP, and the last ones belong to Google. `*` means that router did not reply in time, which is normal because many routers ignore these probes. It does not mean the path is broken.

## 4. `netstat` – routing table and ports

```text
$ netstat -rn -f inet | grep -E "Destination|default" | head -2
Destination        Gateway            Flags               Netif Expire
default            100.128.160.1      UGScg                 en0       

$ ifconfig en0 | grep -E 'flags|inet |status'
en0: flags=8863<UP,BROADCAST,SMART,RUNNING,SIMPLEX,MULTICAST> mtu 1500
	inet 100.128.166.215 netmask 0xfffff000 broadcast 100.128.175.255
	status: active

$ netstat -an -p tcp | grep -c LISTEN
38

$ netstat -an -p tcp | grep ESTABLISHED | wc -l
      52
```

Sample of listening sockets:

```text
$ netstat -an -p tcp | grep LISTEN | head -10
tcp46      0      0  *.9006                 *.*                    LISTEN     
tcp46      0      0  *.9005                 *.*                    LISTEN     
tcp46      0      0  *.9004                 *.*                    LISTEN     
tcp46      0      0  *.9003                 *.*                    LISTEN     
tcp46      0      0  *.9002                 *.*                    LISTEN     
tcp46      0      0  *.9011                 *.*                    LISTEN     
tcp46      0      0  *.59732                *.*                    LISTEN     
tcp46      0      0  *.59731                *.*                    LISTEN     
tcp6       0      0  *.61105                *.*                    LISTEN     
tcp4       0      0  *.61105                *.*                    LISTEN     
```

**What I understood:** the `default` route sends everything that is not local to the gateway `172.20.0.1` through `en0`. `LISTEN` means a program is waiting for connections on that port. `127.0.0.1.port` is only reachable from my own machine, while `*.port` accepts connections from the network. On Linux the modern equivalent is `ss -tulnp`.

## 5. `nslookup`, `dig` and `host` – DNS

```text
$ nslookup github.com
Server:		100.128.160.1
Address:	100.128.160.1#53

Non-authoritative answer:
Name:	github.com
Address: 20.207.73.82


$ dig +noall +answer +stats github.com
github.com.		34	IN	A	20.207.73.82
;; Query time: 17 msec
;; SERVER: 100.128.160.1#53(100.128.160.1)
;; WHEN: Fri Sep 18 01:51:54 IST 2026
;; MSG SIZE  rcvd: 395


$ dig +short MX gmail.com
10 alt1.gmail-smtp-in.l.google.com.
5 gmail-smtp-in.l.google.com.
20 alt2.gmail-smtp-in.l.google.com.
40 alt4.gmail-smtp-in.l.google.com.
30 alt3.gmail-smtp-in.l.google.com.

$ host scaler.com
scaler.com has address 18.172.78.88
scaler.com has address 18.172.78.47
scaler.com has address 18.172.78.107
scaler.com has address 18.172.78.67
scaler.com mail is handled by 10 aspmx3.googlemail.com.
scaler.com mail is handled by 5 alt1.aspmx.l.google.com.
scaler.com mail is handled by 5 alt2.aspmx.l.google.com.
scaler.com mail is handled by 1 aspmx.l.google.com.
scaler.com mail is handled by 10 aspmx2.googlemail.com.
```

**What I understood:** all three ask a DNS server to turn a name into records. `Server: 1.1.1.1` is the resolver that answered. `Non-authoritative answer` means the reply came from a cache, not from GitHub's own name server. In the `dig` output, `20` is the TTL in seconds, `IN A` is an IPv4 address record, and `Query time` tells how slow DNS is. `MX` records list the mail servers of a domain, and the lowest number has the highest priority.

## 6. `curl` – testing HTTP

```text
$ curl -sI https://github.com | head -8
HTTP/2 200 
date: Thu, 17 Sep 2026 20:21:50 GMT
content-type: text/html; charset=utf-8
content-language: en-US
vary: X-PJAX, X-PJAX-Container, Turbo-Visit, Turbo-Frame, X-Requested-With, X-GitHub-Client-Version, Accept-Language, Sec-Fetch-Site,Accept-Encoding, Accept, X-Requested-With
etag: W/"df247f4810c49628aa18ef60b020ef94"
cache-control: max-age=0, private, must-revalidate
strict-transport-security: max-age=31536000; includeSubdomains; preload

$ curl -s -o /dev/null -w "http_code=%{http_code} dns=%{time_namelookup}s connect=%{time_connect}s tls=%{time_appconnect}s total=%{time_total}s\n" https://github.com
http_code=200 dns=0.002109s connect=0.029174s tls=0.066332s total=0.314198s
```

**What I understood:** `-I` fetches only the response headers. `HTTP/2 200` means success. The `-w` format breaks the request into DNS lookup, TCP connect, TLS handshake and total time, which shows which step is slow.

## 7. `nc` (netcat) – is a TCP port open?

`telnet` is not installed on recent macOS versions, so I used `nc -vz`, which does the same port check.

```text
$ nc -vz -w 3 github.com 443
Connection to github.com port 443 [tcp/https] succeeded!

$ nc -vz -w 3 github.com 81
nc: connectx to github.com port 81 (tcp) failed: Operation timed out
```

**What I understood:** port 443 (HTTPS) is open on github.com. Port 81 timed out, which means a firewall silently dropped the packets. A closed port on a reachable host would give `Connection refused` immediately instead of a timeout.

---

## IP addressing notes (from the session)

| Class | First octet | Default mask | Network / host bits | Usable hosts |
|---|---|---|---|---|
| A | 1 – 127 | 255.0.0.0 (`/8`) | 8 / 24 | 2^24 − 2 |
| B | 128 – 191 | 255.255.0.0 (`/16`) | 16 / 16 | 2^16 − 2 |
| C | 192 – 223 | 255.255.255.0 (`/24`) | 24 / 8 | 2^8 − 2 = 254 |
| D | 224 – 239 | multicast | – | – |

Private ranges: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`.

Two addresses are subtracted because the first address is the network address and the last one is the broadcast address. Example: `197.23.45.10` with mask `255.255.255.0` is class C, the network is `197.23.45.0`, the broadcast is `197.23.45.255`, and the usable hosts are `.1` to `.254`.

## Troubleshooting order I learned

1. `ifconfig` – do I have an IP?
2. `ping <gateway>` – is the local network fine?
3. `ping 8.8.8.8` – is the internet reachable by IP?
4. `nslookup <name>` – is DNS working?
5. `nc -vz <host> <port>` – is the port open?
6. `curl -I <url>` – is the application answering?
