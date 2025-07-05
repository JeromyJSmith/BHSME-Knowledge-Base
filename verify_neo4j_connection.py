from neo4j import GraphDatabase
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

uri = "bolt://localhost:7687"
username = "neo4j"
password = "password"

def verify_connection():
    try:
        driver = GraphDatabase.driver(uri, auth=(username, password))
        driver.verify_connectivity()
        logger.info("Successfully connected to Neo4j!")
        driver.close()
        return True
    except Exception as e:
        logger.error(f"Failed to connect to Neo4j: {e}")
        return False

if __name__ == "__main__":
    verify_connection()