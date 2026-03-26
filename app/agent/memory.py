from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from app.config import settings

_checkpointer: AsyncPostgresSaver | None = None
_conn_manager = None


async def init_checkpointer() -> AsyncPostgresSaver:
    """
    Inicializa o AsyncPostgresSaver entrando no context manager.
    Deve ser chamado no startup da aplicação.
    """
    global _checkpointer, _conn_manager
    _conn_manager = AsyncPostgresSaver.from_conn_string(settings.postgres_dsn)
    _checkpointer = await _conn_manager.__aenter__()
    await _checkpointer.setup()
    return _checkpointer


async def close_checkpointer():
    """Fecha a conexão do checkpointer. Deve ser chamado no shutdown."""
    global _conn_manager
    if _conn_manager is not None:
        await _conn_manager.__aexit__(None, None, None)
        _conn_manager = None


def get_checkpointer() -> AsyncPostgresSaver:
    if _checkpointer is None:
        raise RuntimeError("Checkpointer não inicializado. Verifique o startup da aplicação.")
    return _checkpointer
