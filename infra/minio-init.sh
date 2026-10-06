#!/bin/sh
# Prepara o MinIO para a aplicação (idempotente — pode rodar várias vezes):
#   1. bucket privado
#   2. política com acesso SOMENTE a esse bucket
#   3. usuário da aplicação (S3_ACCESS_KEY / S3_SECRET_KEY) com essa política
set -eu

echo "Aguardando o MinIO responder..."
tentativas=0
until mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1; do
  tentativas=$((tentativas + 1))
  if [ "$tentativas" -ge 60 ]; then
    echo "MinIO não respondeu em 2 minutos." >&2
    exit 1
  fi
  sleep 2
done

mc mb --ignore-existing "local/$S3_BUCKET"
mc anonymous set none "local/$S3_BUCKET"

cat > /tmp/politica-app.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": ["arn:aws:s3:::$S3_BUCKET/*"]
    },
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": ["arn:aws:s3:::$S3_BUCKET"]
    }
  ]
}
EOF

mc admin policy create local gestao-documentos-app /tmp/politica-app.json
mc admin user add local "$S3_ACCESS_KEY" "$S3_SECRET_KEY"
mc admin policy attach local gestao-documentos-app --user "$S3_ACCESS_KEY" >/dev/null 2>&1 || true

echo "MinIO pronto: bucket \"$S3_BUCKET\" privado e usuário da aplicação configurado."
