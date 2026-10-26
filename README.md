# Tek-List API

Backend of the Tek-List e-commerce platform, built as a set of **NestJS microservices** behind an API gateway. Services communicate asynchronously through **Kafka** and persist data in **PostgreSQL**.

## Architecture

```
                    ┌──────────────┐
   Client ────────► │   Gateway    │  (auth middleware + route access control)
                    └──────┬───────┘
        ┌──────────┬───────┼─────────┬──────────┬──────────┐
        ▼          ▼       ▼         ▼          ▼          ▼
      Auth       User   Product    Order     Review    AI service
                                                       (external)
        └──────────┴───────┴────┬────┴──────────┘
                                ▼
                    Kafka  ◄──────►  Notification
                                ▼
                           PostgreSQL
```

| Service | Folder | Default port | Responsibility |
|---|---|---|---|
| Gateway | `gateway` | 3000 | Single entry point, JWT verification, role-based route access (`routesAccess.json`), request proxying |
| Authentication | `authentication` | 3001 | Login, registration, refresh tokens, password reset |
| User | `user-microservice` | 3004 | User profiles, image upload, user filtering, seeding |
| Product | `product-microservice` | 3005 | Products, categories, cart, image uploads, filtered search |
| Review | `review-microservice` | 3006 | Product reviews (checks with the order service that the user bought the product) |
| Order | `order-microservice` | 3007 | Orders and order items, Stripe payments, dashboard statistics |
| Notification | `notification-microservice` | — (Kafka only) | Sends emails (Nodemailer) in response to Kafka events |

Each HTTP service exposes Swagger documentation at `http://localhost:<port>/api-docs`.

## Tech stack

- NestJS 11 / TypeScript
- PostgreSQL + TypeORM
- Kafka (KafkaJS) + Zookeeper
- JWT authentication (access + refresh tokens)
- Stripe, Nodemailer, Multer
- Docker / Docker Compose

## Getting started

### Prerequisites

- Node.js 18+
- Docker and Docker Compose

### 1. Start the infrastructure

PostgreSQL, Zookeeper and Kafka are defined in `docker-compose.yaml`:

```bash
docker compose up -d
```

Kafka is reachable from the host on `localhost:29092`.

### 2. Configure environment variables

Create a `.env` file in each service folder. The main variables are:

| Variable | Used by | Description |
|---|---|---|
| `PORT` | all HTTP services | Port the service listens on |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` | auth, user, product, order, review | PostgreSQL connection |
| `KAFKA_BROKERS` | all except gateway | Comma-separated Kafka brokers (e.g. `localhost:29092`) |
| `JWT_SECRET`, `JWT_EXPIRATION`, `JWT_REFRESH_EXPIRATION` | auth, gateway, user | JWT signing and lifetimes |
| `FRONTEND_URL` | auth, gateway | Allowed origin / links in emails |
| `UPLOAD_PATH` | user, product | Folder for uploaded images |
| `STRIPE_SECRET_KEY` | order | Stripe API key |
| `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | notification | Email sending |
| `*_SERVICE_URL`, `*_SERVICE_PORT` | gateway | Location of each downstream service (`AUTH`, `USER`, `PRODUCT`, `ORDER`, `REVIEW`, `RECOMMENDATION`) |

### 3. Install and run the services

In each service folder:

```bash
npm install
npm run start:dev
```

Start the gateway last, once the other services are up.

## Project structure

```
.
├── authentication/
├── gateway/
├── notification-microservice/
├── order-microservice/
├── product-microservice/
├── review-microservice/
├── user-microservice/
└── docker-compose.yaml
```

Each service is a standalone NestJS project with its own `package.json`, `Dockerfile` and tests.
