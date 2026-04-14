from typing import List, Dict, Any, Optional
from pydantic import BaseModel

class AgentDefinition(BaseModel):
    id: str
    name: str
    description: str
    industry_match: List[str]
    prerequisites: List[str]
    configurable_fields: List[str]
    class_path: Optional[str] = None # format: 'module.ClassName'
    enabled_by_default: bool = False

AGENT_REGISTRY: Dict[str, AgentDefinition] = {
    # Existing Agents
    "sales-insight": AgentDefinition(
        id="sales-insight",
        name="Sales Insight Agent",
        description="Analisi avanzata di leads, spese marketing e ROI.",
        industry_match=["Retail", "SaaS", "E-commerce", "Servizi"],
        prerequisites=["leads_data", "spend_data"],
        configurable_fields=["kpis", "target_cpl", "data_sources"],
        class_path="agents.sales_insight.SalesAgent",
        enabled_by_default=True
    ),
    "warehouse-intelligence": AgentDefinition(
        id="warehouse-intelligence",
        name="Warehouse Intelligence",
        description="Gestione intelligente dello stock e suggerimenti di bundling.",
        industry_match=["Retail", "E-commerce", "Manifattura"],
        prerequisites=["inventory_data"],
        configurable_fields=["reorder_thresholds", "margin_targets"],
        class_path="agents.warehouse.WarehouseAgent",
        enabled_by_default=True
    ),
    "logistic-efficiency": AgentDefinition(
        id="logistic-efficiency",
        name="Logistic Efficiency Agent",
        description="Ottimizzazione del picking e previsione ritardi spedizioni.",
        industry_match=["E-commerce", "Logistica", "Distribuzione"],
        prerequisites=["orders_data", "shipping_data"],
        configurable_fields=["picking_strategy", "couriers"],
        enabled_by_default=True
    ),
    "hr-copilot": AgentDefinition(
        id="hr-copilot",
        name="HR Copilot",
        description="Screening automatizzato dei CV e analisi delle performance.",
        industry_match=["Tutti"],
        prerequisites=["cv_data", "employee_metrics"],
        configurable_fields=["matching_threshold", "performance_metrics"],
        enabled_by_default=False
    ),
    "competitor-radar": AgentDefinition(
        id="competitor-radar",
        name="Competitor Radar",
        description="Analisi comparativa dei prezzi e degli USP dei competitor.",
        industry_match=["Retail", "SaaS", "E-commerce"],
        prerequisites=["competitor_urls"],
        configurable_fields=["monitoring_frequency"],
        enabled_by_default=False
    ),
    "crm-automation": AgentDefinition(
        id="crm-automation",
        name="CRM & Automation Agent",
        description="Gestione profili clienti e automazione marketing email.",
        industry_match=["Retail", "SaaS", "E-commerce"],
        prerequisites=["customer_contacts", "purchase_history"],
        configurable_fields=["email_templates", "automation_triggers"],
        enabled_by_default=True
    ),
    "task-force": AgentDefinition(
        id="task-force",
        name="Task Force Manager",
        description="Gestione progetti critici e generazione SITREP via AI.",
        industry_match=["Tutti"],
        prerequisites=["project_task_data"],
        configurable_fields=["report_frequency"],
        enabled_by_default=True
    ),
    # Future Agents (Placeholders)
    "finance-advisor": AgentDefinition(
        id="finance-advisor",
        name="Finance Advisor AI",
        description="Analisi flussi di cassa e previsioni finanziarie.",
        industry_match=["Tutti"],
        prerequisites=["accounting_data"],
        configurable_fields=["tax_jurisdiction"],
    ),
    "legal-compliance": AgentDefinition(
        id="legal-compliance",
        name="Legal & Compliance Bot",
        description="Verifica contrattualistica e conformità normativa.",
        industry_match=["Finanza", "Healthcare", "Corporate"],
        prerequisites=["contracts_data", "regulations"],
        configurable_fields=["regulation_types"],
    ),
    "social-media-manager": AgentDefinition(
        id="social-media-manager",
        name="Social Media Manager AI",
        description="Generazione contenuti e monitoraggio sentiment social.",
        industry_match=["B2C", "Entertainment", "Lifestyle"],
        prerequisites=["social_accounts"],
        configurable_fields=["posting_schedule", "brand_voice"],
    ),
    "customer-support-ai": AgentDefinition(
        id="customer-support-ai",
        name="Customer Support Agent",
        description="Risoluzione ticket e assistenza clienti multilingua.",
        industry_match=["SaaS", "E-commerce"],
        prerequisites=["knowledge_base", "ticket_history"],
        configurable_fields=["support_policy"],
    ),
    "it-infrastructure": AgentDefinition(
        id="it-infrastructure",
        name="IT Infrastructure Monitor",
        description="Monitoraggio sistemi e suggerimenti per l'escalation IT.",
        industry_match=["Tech", "Manufacturing"],
        prerequisites=["server_logs", "cloud_metrics"],
        configurable_fields=["alert_channels"],
    ),
}

def get_agent_definitions() -> List[AgentDefinition]:
    return list(AGENT_REGISTRY.values())
