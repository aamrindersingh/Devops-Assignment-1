# Dockerfiles & Images – Multi-Stage Build Homework

**Name:** Amrinder Singh
**Enrollment / Roll No:** 24BCS10596

---

## Task 1: Run the multi-stage Dockerfile

Source: [`session6-7-docker/multi-stage-dockerfile`](https://github.com/Nency-Ravaliya/devops-heros/tree/main/session6-7-docker/multi-stage-dockerfile) from the class repository.

### 1. Clone the repository, 2. build the image

The build log is filtered to the step headers so that it stays readable.

```text
$ git clone --quiet --depth 1 https://github.com/Nency-Ravaliya/devops-heros.git && ls devops-heros/session6-7-docker/multi-stage-dockerfile
Dockerfile
package.json
server.js

$ cd devops-heros/session6-7-docker/multi-stage-dockerfile && docker build -t multistage-hello:1.0 . 2>&1 | tail -6
#13 exporting manifest list sha256:52d0716b2ac4749021f33c6ce681be3916bcb9eca72e90217358bc54d48f4874 done
#13 naming to docker.io/library/multistage-hello:1.0 done
#13 unpacking to docker.io/library/multistage-hello:1.0 0.1s done
#13 DONE 0.2s

View build details: docker-desktop://dashboard/build/desktop-linux/desktop-linux/nibx64bt42ltfxz99gbdrwkc8
```

Both stages are visible in the log: `[builder 1/5 … 5/5]` is stage 1 and `[production 3/5 … 5/5]` is stage 2.

### 3. Run a container on port 8080

The application listens on port 3000 inside the container, so host port **8080** is mapped to it with `-p 8080:3000`.

```text
$ docker run -d --name multistage-hello -p 8080:3000 multistage-hello:1.0
53b434cc5a21cb4c0b6b9bb52be7fb8dcccdafd36f6fa2dd7bb97d2d83a8b738
```

### 4. Verify with `docker ps` – container running on port 8080

```text
$ docker ps --filter name=multistage-hello
CONTAINER ID   IMAGE                  COMMAND                  CREATED         STATUS         PORTS                                         NAMES
53b434cc5a21   multistage-hello:1.0   "docker-entrypoint.s…"   7 seconds ago   Up 6 seconds   0.0.0.0:8080->3000/tcp, [::]:8080->3000/tcp   multistage-hello
```

`0.0.0.0:8080->3000/tcp` confirms the application is published on port 8080.

### 5. Access the application

```text
$ curl -s http://localhost:8080
<h1>Hello World from Docker Multi-Stage Build!</h1>docker logs multistage-hello

> docker-hello-world@1.0.0 start
> node server.js

Server running on port 3000
```

The page shows **Hello World from Docker Multi-Stage Build!** at <http://localhost:8080>.

### 6. Inspect the final image

```text
$ docker history --format "table {{.CreatedBy}}\t{{.Size}}" multistage-hello:1.0 | head -8
CREATED BY                                      SIZE
CMD ["npm" "start"]                             0B
EXPOSE [3000/tcp]                               0B
COPY /app/server.js ./ # buildkit               12.3kB
RUN /bin/sh -c npm install --omit=dev # buil…   9.44MB
COPY /app/package*.json ./ # buildkit           45.1kB
WORKDIR /app                                    8.19kB
CMD ["node"]                                    0B
```

Final image size: `multistage-hello:1.0` = **243MB**.

---

## Task 2: Documentation

This file is the documentation. It contains my name, my enrollment number, the output of the application running successfully, and the `docker ps` output showing the container on port 8080.

---

## Task 3: Deploy at least 3 different types of applications with Docker

I deployed six: Node.js, Python, Java, Apache, React and Nginx. The code, Dockerfiles and full build/run output are in [05_Docker_Fundamental](../05_Docker_Fundamental/README.md). Summary of the three required types:

| App | Dockerfile | Run command | Result |
|---|---|---|---|
| Node.js | [nodejs-app/Dockerfile](../05_Docker_Fundamental/nodejs-app/Dockerfile) | `docker run -d -p 9011:3000 hw-nodejs:1.0` | `<h1>Hello World</h1>` |
| Python | [python-app/Dockerfile](../05_Docker_Fundamental/python-app/Dockerfile) | `docker run -d -p 9002:8000 hw-python:1.0` | `<h1>Hello World</h1>` |
| Java | [java-app/Dockerfile](../05_Docker_Fundamental/java-app/Dockerfile) | `docker run -d -p 9003:8080 hw-java:1.0` | `<h1>Hello World</h1>` |

```text
$ docker ps --filter "name=^hw-" --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
NAMES       IMAGE           STATUS          PORTS
hw-nginx    hw-nginx:1.0    Up 57 minutes   0.0.0.0:9006->80/tcp, [::]:9006->80/tcp
hw-react    hw-react:1.0    Up 57 minutes   0.0.0.0:9005->80/tcp, [::]:9005->80/tcp
hw-apache   hw-apache:1.0   Up 57 minutes   0.0.0.0:9004->80/tcp, [::]:9004->80/tcp
hw-java     hw-java:1.0     Up 57 minutes   0.0.0.0:9003->8080/tcp, [::]:9003->8080/tcp
hw-python   hw-python:1.0   Up 57 minutes   0.0.0.0:9002->8000/tcp, [::]:9002->8000/tcp
hw-nodejs   hw-nodejs:1.0   Up 57 minutes   0.0.0.0:9011->3000/tcp, [::]:9011->3000/tcp
```

---

## What I understood about multi-stage builds

- A multi-stage Dockerfile has more than one `FROM`. Each `FROM` starts a new stage, and a stage can be named with `AS builder`.
- `COPY --from=builder <src> <dest>` copies only the chosen files from an earlier stage. Everything else in that stage (compilers, dev dependencies, caches, source files) is thrown away.
- Only the **last** stage becomes the final image. `docker history` above shows that the final image contains just `package.json`, production dependencies (`npm install --omit=dev`, 9.44 MB) and `server.js`.
- Benefits: smaller images, faster pulls and deployments, and a smaller attack surface because build tools are not shipped to production.
- The gain is biggest for compiled languages (Go, Java, React builds), where the final stage can be a tiny runtime or just Nginx. My React app in `05_Docker_Fundamental/React-app` uses the same technique: built with Node, served by Nginx, final image about 100 MB.
- `docker build --target builder .` builds only up to a named stage, which is useful for debugging.
