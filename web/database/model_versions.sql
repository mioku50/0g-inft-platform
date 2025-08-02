-- Model Versions Database Schema
-- For managing AI model lifecycle in the fine-tuning system

CREATE TABLE IF NOT EXISTS model_versions (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL,
    model_root_hash VARCHAR(66) NOT NULL UNIQUE, -- bytes32 as hex string
    status VARCHAR(20) NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'active', 'archived')),
    
    -- Training metadata
    dataset_root_hash VARCHAR(66) NOT NULL,
    pretrained_hash VARCHAR(66) NOT NULL,
    training_params_hash VARCHAR(66) NOT NULL,
    task_id VARCHAR(255) NOT NULL,
    
    -- Optional metadata
    metrics_json JSONB,
    log_root_hash VARCHAR(66),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    activated_at TIMESTAMP WITH TIME ZONE,
    archived_at TIMESTAMP WITH TIME ZONE,
    
    -- Additional tracking
    provider_address VARCHAR(42) NOT NULL, -- ethereum address
    user_address VARCHAR(42) NOT NULL,     -- user who initiated training
    
    -- Constraints
    UNIQUE(agent_id, model_root_hash)
);

-- Optional: User consent tracking table
CREATE TABLE IF NOT EXISTS consents (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL,
    user_address VARCHAR(42) NOT NULL,
    consent_type VARCHAR(50) NOT NULL, -- 'fineTune', 'activate', etc.
    payload_json JSONB NOT NULL,
    signature TEXT NOT NULL,
    signature_hash VARCHAR(66) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_model_versions_agent_id ON model_versions(agent_id);
CREATE INDEX IF NOT EXISTS idx_model_versions_status ON model_versions(status);
CREATE INDEX IF NOT EXISTS idx_model_versions_model_root_hash ON model_versions(model_root_hash);
CREATE INDEX IF NOT EXISTS idx_model_versions_task_id ON model_versions(task_id);
CREATE INDEX IF NOT EXISTS idx_model_versions_created_at ON model_versions(created_at);

-- Consent table indexes
CREATE INDEX IF NOT EXISTS idx_consents_agent_id ON consents(agent_id);
CREATE INDEX IF NOT EXISTS idx_consents_user_address ON consents(user_address);
CREATE INDEX IF NOT EXISTS idx_consents_consent_type ON consents(consent_type);

-- Ensure only one active model per agent
CREATE UNIQUE INDEX IF NOT EXISTS idx_model_versions_active_agent 
ON model_versions(agent_id) 
WHERE status = 'active';

-- Comments for documentation
COMMENT ON TABLE model_versions IS 'Tracks AI model versions throughout their lifecycle from candidate to active to archived';
COMMENT ON COLUMN model_versions.agent_id IS 'NFT token ID of the agent this model belongs to';
COMMENT ON COLUMN model_versions.model_root_hash IS 'Root hash of the trained model in 0G Storage';
COMMENT ON COLUMN model_versions.status IS 'Current status: candidate (delivered), active (in use), archived (superseded)';
COMMENT ON COLUMN model_versions.dataset_root_hash IS 'Root hash of the training dataset';
COMMENT ON COLUMN model_versions.task_id IS 'Unique identifier from the 0G compute network task';
COMMENT ON COLUMN model_versions.metrics_json IS 'Training metrics and performance data';

COMMENT ON TABLE consents IS 'Off-chain user signatures for fine-tuning operations';
COMMENT ON COLUMN consents.signature_hash IS 'Hash of the signature stored on-chain for verification';