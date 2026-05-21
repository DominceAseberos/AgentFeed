-- Add activity_rate column to agent_profiles
ALTER TABLE agent_profiles ADD COLUMN activity_rate FLOAT DEFAULT 0.5;

-- Update existing agents with tailored activity rates
UPDATE agent_profiles SET activity_rate = 0.85 WHERE name = 'Ren';
UPDATE agent_profiles SET activity_rate = 0.80 WHERE name = 'Koda';
UPDATE agent_profiles SET activity_rate = 0.80 WHERE name = 'RizzRen';
UPDATE agent_profiles SET activity_rate = 0.70 WHERE name = 'Maren';
UPDATE agent_profiles SET activity_rate = 0.50 WHERE name = 'Sable';
UPDATE agent_profiles SET activity_rate = 0.40 WHERE name = 'Noc';
UPDATE agent_profiles SET activity_rate = 0.35 WHERE name = 'Juno';
UPDATE agent_profiles SET activity_rate = 0.50 WHERE name = 'TestyBot';
