# LOCALIZATION BATCH PLAN

Scenario:
scenario-003-booking-optimizer

Source:
fr

Already generated:
de
en
es

Remaining:
it
pt
nl
ja
zh
ko
ar

Recommended order:
1. it
2. pt
3. nl
4. ja
5. zh
6. ko
7. ar

Commands:
MARKETING_AGENT_PROVIDER=openai bash marketing-agent/tools/run-translation-agent.sh scenario-003-booking-optimizer --locale=it
MARKETING_AGENT_PROVIDER=openai bash marketing-agent/tools/run-translation-agent.sh scenario-003-booking-optimizer --locale=pt
MARKETING_AGENT_PROVIDER=openai bash marketing-agent/tools/run-translation-agent.sh scenario-003-booking-optimizer --locale=nl
MARKETING_AGENT_PROVIDER=openai bash marketing-agent/tools/run-translation-agent.sh scenario-003-booking-optimizer --locale=ja
MARKETING_AGENT_PROVIDER=openai bash marketing-agent/tools/run-translation-agent.sh scenario-003-booking-optimizer --locale=zh
MARKETING_AGENT_PROVIDER=openai bash marketing-agent/tools/run-translation-agent.sh scenario-003-booking-optimizer --locale=ko
MARKETING_AGENT_PROVIDER=openai bash marketing-agent/tools/run-translation-agent.sh scenario-003-booking-optimizer --locale=ar
