package com.cybercup.cybercup_backend.service;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Restricted content must never be routed to the external AI above the configured ceiling (CONFIDENTIAL). */
class GatewayClassificationTests {

    /** Records whether the gateway allowed the external AI; answers nothing (no local model running). */
    static class RecordingLlm extends LlmClient {
        final List<Boolean> externalAllowed = new ArrayList<>();

        RecordingLlm() {
            super("", "m", "m", "http://localhost:1", "m");
        }

        @Override
        public Result generate(String system, String user, boolean external) {
            externalAllowed.add(external);
            return new Result(null, null, 0, "no model in this test");
        }
    }

    private final RecordingLlm llm = new RecordingLlm();
    private final GatewayService gateway = new GatewayService(null, llm, null, null, null, null, null, null, null,
            "CONFIDENTIAL", "MASKED");

    private Map<String, Object> send(Map<String, Object> rag, int contentLevel) {
        return gateway.forward(null, "req", "Summarise", rag, null, "", false, new LinkedHashMap<>(), contentLevel);
    }

    private static Map<String, Object> ragWith(String classification) {
        return Map.of("context", "doc", "results", List.of(Map.of("title", "Doc", "classification", classification,
                "text", "extract")));
    }

    @Test
    void unknownClassificationIsTreatedAsSecretNotPublic() {
        assertEquals(3, GatewayService.levelOf("CONFIDENTAIL"));
        assertEquals(3, GatewayService.levelOf(null));
        assertEquals(0, GatewayService.levelOf("public"));
        try {
            send(ragWith("TOPSECRET"), 0);
        } catch (NullPointerException ignored) {
            // With no model the gateway shows on-premises extracts and checks them with the engine (not wired here).
        }
        assertFalse(llm.externalAllowed.get(0));
    }

    @Test
    void markingsInPromptOrAttachmentSetTheLevel() {
        assertEquals(3, GatewayService.markingLevel("TOP SECRET"));
        assertEquals(3, GatewayService.markingLevel("गुप्त"));
        assertEquals(2, GatewayService.markingLevel("CONFIDENTIAL"));
        assertEquals(2, GatewayService.markingLevel("गोपनीय"));
        assertEquals(1, GatewayService.markingLevel("INTERNAL ONLY"));
        assertEquals(3, GatewayService.markingLevel("SOMETHING ELSE"));
        assertEquals(3, GatewayService.contentLevel(List.of(
                Map.of("type", "PERSON"), Map.of("type", "CLASSIFICATION_MARKING", "preview", "SECRET"))));
        assertEquals(0, GatewayService.contentLevel(List.of(Map.of("type", "PERSON"))));
    }

    @Test
    void secretMarkedContentIsNeverSentExternally() {
        Map<String, Object> res = send(null, 3);
        assertFalse(llm.externalAllowed.get(0));
        assertTrue(String.valueOf(res.get("message")).contains("Nothing was sent"));
    }

    @Test
    void contentAtTheCeilingMayStillUseTheExternalAi() {
        send(null, 2);
        send(ragWith("CONFIDENTIAL"), 0);
        assertEquals(List.of(true, true), llm.externalAllowed);
    }
}
