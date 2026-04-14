from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from .runtime.schemas import AgentResult

class BaseAgent(ABC):
    """
    Standard interface for all 12 platform agents.
    Every agent must implement this 'run' method to be compatible with the Orchestrator.
    """
    
    def __init__(self, company_id: int, config: Dict[str, Any]):
        self.company_id = company_id
        self.config = config

    @abstractmethod
    async def run(self, input_data: str, context: Optional[Dict[str, Any]] = None) -> AgentResult:
        """
        Main execution point for the agent.
        :param input_data: The specific query or data payload for this run.
        :param context: Optional platform context (session, RAG, etc).
        """
        pass
