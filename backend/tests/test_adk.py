def test_adk_agents_build():
    from kintsugi_adk.agent import root_agent

    assert root_agent.name == "kintsugi"
    assert {a.name for a in root_agent.sub_agents} == {"architect", "market", "ledger"}
