import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

if not DATABASE_URL:
    print("ERRORE: DATABASE_URL mancante nel .env")
    exit(1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

def promote_to_admin(email: str):
    db = SessionLocal()
    try:
        # Trova utente
        user = db.execute(text("SELECT id, email, is_admin FROM user_profiles WHERE email = :email"), {"email": email.lower().strip()}).first()
        
        if not user:
            print(f"ERRORE: Utente con email '{email}' non trovato nel database Supabase.")
            return

        print(f"Utente trovato! ID: {user[0]}, Admin attuale: {user[2]}")
        
        # Promuovi a admin
        db.execute(text("UPDATE user_profiles SET is_admin = 1 WHERE id = :id"), {"id": user[0]})
        
        # Assicurati che abbia tutti i permessi per gli agenti
        agents = ["sales-insight", "hr-copilot", "competitor-radar", "task-force"]
        for agent in agents:
            # Controlla se il permesso esiste già
            exists = db.execute(text("SELECT 1 FROM user_permissions WHERE user_id = :u_id AND agent_slug = :a_slug"), 
                                {"u_id": user[0], "a_slug": agent}).first()
            if not exists:
                db.execute(text("INSERT INTO user_permissions (user_id, agent_slug) VALUES (:u_id, :a_slug)"),
                           {"u_id": user[0], "a_slug": agent})
                print(f"Permesso aggiunto: {agent}")
            else:
                print(f"Permesso già presente: {agent}")
        
        db.commit()
        print(f"COMPLETATO: L'utente {email} è ora Admin con pieni poteri.")
        
    except Exception as e:
        print(f"ERRORE durante l'esecuzione: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    email_to_promote = input("Inserisci l'email dell'account da rendere ADMIN: ").strip()
    if email_to_promote:
        promote_to_admin(email_to_promote)
    else:
        print("Nessuna email inserita.")
