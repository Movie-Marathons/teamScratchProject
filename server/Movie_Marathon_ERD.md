# 🎬 Movie Marathon ERD (Entity Relationship Diagram)

```plaintext
┌────────────┐        ┌──────────────┐        ┌────────────┐
│  cinemas   │◄──────▶│ show_dates   │◄──────▶│  showings  │
└────────────┘        └──────────────┘        └────────────┘
      ▲                        ▲                      ▲
      │                        │                      │
      │                        │                      │
      ▼                        │                      │
┌────────────┐        ┌──────────────┐               │
│   films    │◄──────▶│ film_genres  │◄──────▶ genres│
│            │◄──────▶│ film_ratings │◄──────▶ratings│
│            │◄──────▶│   images     │               │
└────────────┘        └──────────────┘               │
```

## Table Descriptions

- **cinemas**: Theaters or locations
- **show_dates**: Dates tied to each cinema
- **films**: Movie info (title, synopsis, duration, etc.)
- **showings**: Links a film to a cinema and date/time
- **genres**: Genre types (e.g., Action, Romance)
- **film_genres**: Bridge table for many-to-many film↔genre
- **age_ratings**: Ratings like PG-13, R
- **film_ratings**: Bridge table for many-to-many film↔rating
- **images**: Base64-encoded image data for films
