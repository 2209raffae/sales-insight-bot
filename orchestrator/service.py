from sqlalchemy.orm import Session
from .profiler import profile_company
from .selector import select_agents, generate_configurations
from models import Company, CompanyProfile, ActiveAgent, AgentConfiguration
from typing import Dict, Any

async def setup_new_company(db: Session, name: str, description: str, metadata: Dict[str, Any] = {}):
    """
    Executes the full orchestration flow for a new company.
    """
    # 1. Create Company
    company = Company(name=name, description=description, metadata_json=metadata)
    db.add(company)
    db.flush() # Get company.id

    # 2. Profile with AI
    profile_data = await profile_company(name, description, metadata)
    
    # 3. Persist Profile
    profile = CompanyProfile(
        company_id=company.id,
        industry=profile_data["industry"],
        company_size=profile_data["company_size"],
        channels=profile_data["channels"],
        needs=profile_data["needs"],
        complexity_level=profile_data["complexity_level"],
        suggested_agents=profile_data["suggested_agents"]
    )
    db.add(profile)

    # 4. Select Agents
    activated_agents = select_agents(profile_data)
    
    # 5. Generate and Save Configs
    agent_configs = generate_configurations(profile_data, activated_agents)
    
    for agent_data in activated_agents:
        active_agent = ActiveAgent(
            company_id=company.id,
            agent_slug=agent_data["agent_slug"],
            is_enabled=agent_data["is_enabled"],
            activation_reason=agent_data["reason"]
        )
        db.add(active_agent)
        db.flush()

        if active_agent.agent_slug in agent_configs:
            config = AgentConfiguration(
                active_agent_id=active_agent.id,
                config_json=agent_configs[active_agent.agent_slug],
                use_vector_memory=0, # Default
                retrieval_mode="none"
            )
            db.add(config)

    db.commit()
    return company.id

def get_company_setup(db: Session, company_id: int):
    """
    Retrieves the full setup for a company.
    """
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        return None
        
    agents = db.query(ActiveAgent).filter(ActiveAgent.company_id == company_id).all()
    
    setup = {
        "company": {
            "id": company.id,
            "name": company.name,
            "description": company.description
        },
        "profile": {
            "industry": company.profile.industry if company.profile else "Unknown",
            "size": company.profile.company_size if company.profile else "Unknown",
            "suggested": company.profile.suggested_agents if company.profile else []
        },
        "active_agents": []
    }
    
    for a in agents:
        setup["active_agents"].append({
            "slug": a.agent_slug,
            "enabled": True if a.is_enabled == 1 else False,
            "config": a.config.config_json if a.config else {}
        })
        
    return setup
