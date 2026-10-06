// Variáveis mínimas para carregar a aplicação nos testes (nenhum serviço real é chamado).
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.SUPABASE_URL = "http://supabase.test";
process.env.SUPABASE_ANON_KEY = "anon-test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-test";
process.env.S3_ENDPOINT = "http://minio.test:9000";
process.env.S3_ACCESS_KEY = "minio-test";
process.env.S3_SECRET_KEY = "minio-test-secret";
