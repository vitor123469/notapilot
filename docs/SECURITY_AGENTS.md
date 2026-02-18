# Security Guidelines for Cloud Agents

Estas diretrizes definem os guardrails minimos de seguranca para uso de Cloud Agents.

- Nunca use secrets de producao em execucoes de Cloud Agents.
- Prefira ambientes de desenvolvimento ou staging.
- Aplique sempre o principio de least privilege para tokens, chaves e permissoes.
- Revisao humana e obrigatoria antes de qualquer merge.
- Evite comandos destrutivos e irreversiveis no fluxo automatizado.
