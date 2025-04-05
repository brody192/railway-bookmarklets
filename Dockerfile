############# STAGE 1 #############

FROM golang:1.23.1-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./

RUN go mod download

COPY . ./

RUN go build -ldflags="-w -s" -o main

############# STAGE 2 #############

FROM gcr.io/distroless/static

WORKDIR /app

COPY --from=builder /app/main ./

COPY ./assets/ ./assets/
COPY ./bookmarklets/ ./bookmarklets/

ENTRYPOINT ["/app/main"]