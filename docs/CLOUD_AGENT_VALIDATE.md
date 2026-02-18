# CLOUD AGENT VALIDATE
Este guia valida o pipeline do Cloud Agent de ponta a ponta.
Para rodar lint, execute `pnpm lint` na raiz do repositorio.
Aguarde a conclusao e corrija qualquer erro reportado antes de seguir.
Para gerar o build, execute `pnpm build` tambem na raiz do projeto.
Confirme que todos os pacotes terminam com status de sucesso.
Regra obrigatoria de fluxo: sempre trabalhe em uma branch dedicada.
Abra um Pull Request com as alteracoes para revisao.
Nunca faca commit ou push diretamente na branch `main`.
So faca merge apos aprovacao e pipeline verde.
