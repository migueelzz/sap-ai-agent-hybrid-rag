# app/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # Banco
    database_url: str
    postgres_user: str = "atem"
    postgres_password: str = "atem_secret"
    postgres_db: str = "atem_rag"
    postgres_host: str = "localhost"
    postgres_port: int = 5432

    # Embeddings
    embedding_model: str = "paraphrase-MiniLM-L6-v2"

    # LLM — agnóstico via LiteLLM proxy (OpenAI-compatible) ou direto
    llm_model: str = "gpt-4o-mini"
    llm_api_key: str = ""
    llm_base_url: str = ""       # vazio = usa endpoint padrão do provider
    llm_max_tokens: int = 4096
    llm_temperature: float = 0.3
    context_window: int = 128000

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )

    @property
    def postgres_dsn(self) -> str:
        """URL psycopg3-compatible para AsyncPostgresSaver (sem driver prefix)."""
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

settings = Settings()
