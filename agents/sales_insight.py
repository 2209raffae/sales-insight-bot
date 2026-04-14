import json
from typing import Any, Dict, Optional
from orchestrator.base_agent import BaseAgent
from orchestrator.runtime.schemas import AgentResult

class SalesAgent(BaseAgent):
    """
    Agente specializzato nell'analisi delle vendite e ROI.
    Semplificato per scopo dimostrativo.
    """
    
    async def run(self, input_data: str, context: Optional[Dict[str, Any]] = None) -> AgentResult:
        # Recupera parametri dalla config
        target_cpl = self.config.get("target_cpl", 15.0)
        
        # Logica semplificata basata sulla query
        if "vendite" in input_data.lower() or "leads" in input_data.lower() or "roi" in input_data.lower():
            return AgentResult(
                status="ok",
                summary="Analisi vendite completata. Il ROI è stabile al 3.5x e il CPL medio è sotto il target impostato.",
                structured_data={
                    "total_leads": 450,
                    "avg_cpl": 12.40,
                    "target_cpl": target_cpl,
                    "roi": 3.5
                },
                signals=["performance_on_track"],
                warnings=[],
                metadata={"source": "sales_logic"}
            )
        
        return AgentResult(
            status="ok",
            summary="Portami pure domande su vendite, leads o marketing ROI.",
            structured_data={},
            metadata={"source": "sales_idle"}
        )
