from pydantic import BaseModel, Field
from typing import List, Dict, Any, Literal

class AgentResult(BaseModel):
    """
    Standardized output for all agents in the Nexus platform.
    """
    status: Literal["ok", "error"]
    summary: str
    structured_data: Dict[str, Any] = Field(default_factory=dict)
    signals: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
