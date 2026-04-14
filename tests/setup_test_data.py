import sys
import os

# Aggiungi la root del progetto al path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database import engine, SessionLocal
from models import Base, Company, ActiveAgent, AgentConfiguration

def setup_test_data():
    print("Inizializzazione database di test...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        # 1. Company A: Retail (ID 999)
        company_a = db.query(Company).filter(Company.id == 999).first()
        if not company_a:
            company_a = Company(
                id=999,
                name="Retail Global Test",
                description="A big retail company selling clothes and food."
            )
            db.add(company_a)
            db.commit()
            print("Creato Company 999 (Retail)")

        # Attiva agenti per Company A
        for slug in ["sales-insight", "warehouse-intelligence"]:
            active = db.query(ActiveAgent).filter(
                ActiveAgent.company_id == 999, 
                ActiveAgent.agent_slug == slug
            ).first()
            if not active:
                active = ActiveAgent(
                    company_id=999,
                    agent_slug=slug,
                    is_enabled=1
                )
                db.add(active)
                db.flush()
                # Aggiungi config base
                config = AgentConfiguration(
                    active_agent_id=active.id,
                    config_json={"api_key": "test_key", "threshold": 10}
                )
                db.add(config)
                print(f"Attivato agente {slug} per Company 999")

        # 2. Company B: Servizi (ID 888)
        company_b = db.query(Company).filter(Company.id == 888).first()
        if not company_b:
            company_b = Company(
                id=888,
                name="Service Solutions Test",
                description="B2B service provider for consulting."
            )
            db.add(company_b)
            db.commit()
            print("Creato Company 888 (Servizi)")

        # Attiva agenti per Company B
        for slug in ["crm-automation", "task-force"]:
            active = db.query(ActiveAgent).filter(
                ActiveAgent.company_id == 888, 
                ActiveAgent.agent_slug == slug
            ).first()
            if not active:
                active = ActiveAgent(
                    company_id=888,
                    agent_slug=slug,
                    is_enabled=1
                )
                db.add(active)
                db.flush()
                config = AgentConfiguration(
                    active_agent_id=active.id,
                    config_json={"templates": ["welcome"]}
                )
                db.add(config)
                print(f"Attivato agente {slug} per Company 888")

        db.commit()
        print("Setup completato con successo.")
        
    except Exception as e:
        db.rollback()
        print(f"Errore durante il setup: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    setup_test_data()
