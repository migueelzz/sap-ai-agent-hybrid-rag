from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Banco
    database_url: str | None = None  # agora opcional
    postgres_user: str = "docker"
    postgres_password: str = "docker"
    postgres_db: str = "postgres_chat_ai"
    postgres_host: str = "localhost"
    postgres_port: int = 5432

    # Embeddings
    embedding_model: str = "paraphrase-MiniLM-L6-v2"

    # LLM
    llm_provider: str = ""   # "google" | "" (usa llm_base_url diretamente)
    llm_model: str = "gemini/gemini-2.5-flash"
    llm_api_key: str = ""
    llm_base_url: str = ""
    llm_max_tokens: int = 4096
    llm_temperature: float = 0.3
    context_window: int = 128000

    # MCP
    mcp_enabled: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )

    @property
    def postgres_dsn(self) -> str:
        """
        Retorna DSN compatível com psycopg (LangGraph).
        Prioriza DATABASE_URL e converte automaticamente.
        """
        if self.database_url:
            # remove driver asyncpg → psycopg precisa disso
            return self.database_url.replace("+asyncpg", "")

        # fallback (ex: rodando local sem docker)
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


settings = Settings()