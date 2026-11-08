# ReadMore API

A REST API for a bookstore, built with Express.js, MongoDB and Mongoose. It has two linked entities: an author can have many books, and every book belongs to one author.

## Requirements

- Node.js 18+
- A MongoDB database (local install or a free MongoDB Atlas cluster)

## Setup

1. Install the dependencies:

   ```bash
   npm install
   ```

2. Create your environment file and fill in your own values:

   ```bash
   cp .env.example .env
   ```

   | Variable    | Description                          |
   |-------------|--------------------------------------|
   | `PORT`      | Port the server listens on (default 3000) |
   | `MONGO_URI` | Your MongoDB connection string       |

3. Start the server:

   ```bash
   npm run dev     # with nodemon, restarts on changes
   npm start       # plain node
   ```

   You should see "Connected to MongoDB". The server only starts listening once the database connection succeeds.

## Project structure

```
server.js        app entry point: connects to the database and starts the server
models/          Author and Book schemas
controllers/     the logic: rules, database calls and status codes
routes/          wires URLs to controller functions
```

## Endpoints

| Method | Path                  | Description                              |
|--------|-----------------------|------------------------------------------|
| GET    | `/`                   | Health check                             |
| POST   | `/authors`            | Create an author                         |
| GET    | `/authors`            | Get all authors                          |
| GET    | `/authors/:id`        | Get one author                           |
| PUT    | `/authors/:id`        | Update an author                         |
| DELETE | `/authors/:id`        | Delete an author (see rule 4 below)      |
| GET    | `/authors/:id/books`  | All books by that author                 |
| GET    | `/authors/:id/stats`  | Book count, average price, cheapest and most expensive title |
| POST   | `/books`              | Create a book for an existing author     |
| GET    | `/books`              | Get books (filter, search, sort, paginate) |
| GET    | `/books/:id`          | Get one book with full author details    |
| PUT    | `/books/:id`          | Update a book                            |
| DELETE | `/books/:id`          | Delete a book                            |

### `GET /books` query parameters

All optional and combinable. Only the parameters present are applied.

| Parameter             | Effect                                                    |
|-----------------------|-----------------------------------------------------------|
| `genre`               | only books of that genre (case-insensitive)               |
| `minPrice`, `maxPrice`| price within the range (either, both or neither)          |
| `author`              | only books by that author id                              |
| `search`              | title contains this text (case-insensitive)               |
| `sort`, `order`       | sort by `price`, `title` or `publishedYear`, `asc` or `desc` |
| `page`, `limit`       | pagination (defaults 1 and 10, limit capped at 100)       |

Example:

```
GET /books?genre=Thriller&minPrice=10&maxPrice=30&search=sea&sort=price&order=asc&page=1&limit=5
```

The response has the shape `{ page, limit, total, results }`.

## Business rules

| Rule | Behaviour | Status |
|------|-----------|--------|
| No orphan books | A book must reference an author that exists | 400 |
| No duplicate titles per author | Same author cannot have two books with the same title, ignoring case. Different authors may share a title. Enforced by a check in the controller and a unique index | 409 |
| Valid price and year | `price` must be greater than 0. `publishedYear` must be between 1450 and the current year | 422 |
| Deleting an author | Blocked while the author still has books | 409 |
| Missing id | Unknown author or book id | 404 |
| Malformed id | An id that is not a valid ObjectId | 400 |

### Author delete policy: block

Deleting an author who still has books is refused with a 409. The books must be deleted or moved to another author first (`PUT /books/:id` with a new `author`).

- **Why:** it protects against accidental deletes and guarantees no book ever points at an author that no longer exists. It also keeps records safe if books have already been sold.
- **Downside:** it adds friction. Removing an author with many books takes one request per book, and a book created at the same moment as the delete could slip through the check.

## Testing

Use Postman, Insomnia or the VS Code REST Client extension. Send `POST` and `PUT` bodies as raw JSON, for example:

```json
{
  "title": "The Silent Sea",
  "genre": "Thriller",
  "price": 24.99,
  "publishedYear": 2021,
  "author": "<an existing author id>"
}
```