# Docker Fundamentals – Homework

**Name:** Amrinder Singh
**Roll No:** 24BCS10596

## Task: Hello World web applications with Docker

Six applications, each in its own folder with its code and a `Dockerfile`.

| # | Folder | Stack | Base image | Container port | Host port used |
|---|---|---|---|---|---|
| 1 | [nodejs-app](nodejs-app) | Node.js `http` server | `node:20` | 3000 | 9011 |
| 2 | [python-app](python-app) | Python `http.server` | `python:3.12` | 8000 | 9002 |
| 3 | [java-app](java-app) | Java `HttpServer` | `eclipse-temurin:21` | 8080 | 9003 |
| 4 | [Apache-app](Apache-app) | Apache httpd static page | `httpd:2.4` | 80 | 9004 |
| 5 | [React-app](React-app) | React + Vite, served by Nginx (multi-stage build) | `node:20-alpine` → `nginx:alpine` | 80 | 9005 |
| 6 | [nginx-app](nginx-app) | Nginx static page | `nginx:alpine` | 80 | 9006 |


The Node app is published on **9011** rather than 9001: another service already running on this laptop holds 9001, and Docker refuses the bind with `port is already allocated`. The container port is still 3000.

## Step 1: Build the images

```bash
docker build -t hw-nodejs:1.0 nodejs-app
docker build -t hw-python:1.0 python-app
docker build -t hw-java:1.0   java-app
docker build -t hw-apache:1.0 Apache-app
docker build -t hw-react:1.0  React-app
docker build -t hw-nginx:1.0  nginx-app
```

```text
$ docker images --format '{{.Repository}}:{{.Tag}}  {{.Size}}' | grep '^hw-' | sort
hw-apache:1.0  205MB
hw-java:1.0  744MB
hw-nginx:1.0  102MB
hw-nodejs:1.0  1.57GB
hw-python:1.0  1.6GB
hw-react:1.0  102MB
```

## Step 2: Run the containers

`-d` runs in the background, `--name` gives a fixed name, `-p host:container` publishes the port.

```text
$ docker run -d --name hw-nodejs -p 9011:3000 hw-nodejs:1.0
7573ea48362ab3bbe75ba7b7005350dddda25e04dce7638d9572c5e1d3991d8f

$ docker run -d --name hw-python -p 9002:8000 hw-python:1.0
71050bfcd163081dd07b9db9c4d23ebaf76c4d6e2de3581426203232811ad2d5

$ docker run -d --name hw-java -p 9003:8080 hw-java:1.0
f5e8ef61a58b0e87f4c43c2bf27ca4d91eb7479a087921a09fa2098869cd602e

$ docker run -d --name hw-apache -p 9004:80 hw-apache:1.0
e90f0299c337f61ddfc97ab8f735f1f27eef2c603c3b4f1902f53d361917fcf2

$ docker run -d --name hw-react -p 9005:80 hw-react:1.0
9d15f328a0f2db951b3f923d64d41eb5922d0333056c98d0d9036fe46775cf3e

$ docker run -d --name hw-nginx -p 9006:80 hw-nginx:1.0
2b32615d7edde0f12d4fe3a01328a2edd29d714ed1802a42d3d6cb43d7d11449
```

## Step 3: Verify the containers are running

```text
$ docker ps --filter "name=^hw-" --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
NAMES       IMAGE           STATUS          PORTS
hw-nginx    hw-nginx:1.0    Up 10 seconds   0.0.0.0:9006->80/tcp, [::]:9006->80/tcp
hw-react    hw-react:1.0    Up 10 seconds   0.0.0.0:9005->80/tcp, [::]:9005->80/tcp
hw-apache   hw-apache:1.0   Up 10 seconds   0.0.0.0:9004->80/tcp, [::]:9004->80/tcp
hw-java     hw-java:1.0     Up 10 seconds   0.0.0.0:9003->8080/tcp, [::]:9003->8080/tcp
hw-python   hw-python:1.0   Up 10 seconds   0.0.0.0:9002->8000/tcp, [::]:9002->8000/tcp
hw-nodejs   hw-nodejs:1.0   Up 10 seconds   0.0.0.0:9011->3000/tcp, [::]:9011->3000/tcp
```

## Step 4: Verify that Hello World is displayed

Each URL can be opened in the browser. Here the same pages are fetched with `curl`.

```text
$ curl -s http://localhost:9011
<h1>Hello World</h1>curl -s http://localhost:9002
<h1>Hello World</h1>curl -s http://localhost:9003
<h1>Hello World</h1>curl -s http://localhost:9004
<h1>Hello World</h1>curl -s http://localhost:9005
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>React Hello World</title>
    <script type="module" crossorigin src="/assets/index-CRbdCdKj.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>

$ curl -s http://localhost:9006
<h1>Hello World</h1>
```

The React page is an empty `<div id="root">` plus a JavaScript bundle, because React draws the heading in the browser. To confirm the text is really in the bundle that Nginx serves:

```text
$ curl -s http://localhost:9005/$(curl -s http://localhost:9005 | grep -o "assets/[^\"]*\.js") | grep -o "Hello World from React"
Hello World from React
```

Opening <http://localhost:9005> in a browser shows the heading **Hello World from React**.

## Step 5: Clean up

```bash
docker rm -f hw-nodejs hw-python hw-java hw-apache hw-react hw-nginx
```

## What I understood

- A `Dockerfile` is the recipe: `FROM` picks the base image, `COPY` adds my code, `RUN` executes at build time, `CMD` is what starts when the container runs, and `EXPOSE` documents the port.
- `EXPOSE` alone does not open anything. The port is only reachable from my laptop because of `-p 9011:3000`.
- The server inside the container must listen on `0.0.0.0`, not `127.0.0.1`, or the published port will not answer.
- Image size depends heavily on the base image. `node:20` and `python:3.12` are over 1.5 GB, while the Nginx based images are about 100 MB. The `-alpine` or `-slim` variants are a simple way to shrink them.
- The React app uses a **multi-stage build**. Stage 1 (`node:20-alpine`) runs `npm install` and `npm run build`. Stage 2 (`nginx:alpine`) copies only the `dist` folder. The final image has no Node.js and no `node_modules`.
