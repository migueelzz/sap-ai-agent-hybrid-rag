### Backend

```bash

docker compose up -d

# setup database
docker cp scripts/schema.sql atem_postgres:/schema.sql
docker exec atem_postgres psql -U atem -d atem_rag -f /schema.sql

# install dependencies
pdm install

# reset database
pdm run python scripts/reset_db.py

# server start port 8000 -> http://localhost:8000
pdm run dev
```

### Frontend

```bash 
cd web

pnpm install

# server start port 5173 -> http://localhost:5173
pnpm dev
```
