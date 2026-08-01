# IIoT — Integração Industrial

## Visão

O módulo IIoT conectará equipamentos, gateways ou sistemas industriais à plataforma para receber telemetria e eventos de forma segura. Não integra o MVP.

## Dados de interesse

- Horímetro, ciclos e tempo ligado.
- Produção, parada e falha.
- Alarmes e códigos de falha.
- Temperatura, corrente, vibração e consumo, quando disponíveis.

## Integrações candidatas

OPC UA, MQTT, Modbus, Ethernet/IP e Profinet, sempre por meio de um gateway ou conector apropriado ao ambiente do cliente.

## Princípios

- A rede industrial não deve ser exposta diretamente à internet.
- O conector opera com credenciais mínimas e comunicação criptografada.
- Eventos brutos são separados de dados transacionais; telemetria não deve degradar as operações de OS.
- Alertas automáticos precisam de regras configuráveis, controle de ruído e confirmação humana quando abrirem OS.
