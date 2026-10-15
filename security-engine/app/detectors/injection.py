"""Rule-based prompt-injection detection (English, Hinglish and Hindi).

Every rule has a weight (how sure we are that a match is an attack). Scores from
several rules combine with a noisy-OR: 1 - Π(1 - w). Rules run on every normalised
"view" of the prompt (clean, de-spaced, leetspeak-folded, base64/hex-decoded,
ROT13, reversed), so simple obfuscation does not hide an attack.
"""
import re
from dataclasses import dataclass

from app.normalizer import NormalizedText
from app.schemas import Category, Finding

VERB_REVEAL = r"(?:reveal|show|print|display|output|repeat|echo|tell|give|share|read|quote|state|disclose|dump|leak|reproduce|recite|write out|copy|list|paste|spell out|provide|send|return|expose)"
TARGET_SYS = (r"(?:system|initial|original|hidden|secret|internal|developer|pre-?|base|starting|first|core|confidential)\s*"
              r"(?:prompt|instructions?|message|rules|guidelines|configuration|config|directives|context|setup|policy|policies)")
SECOND_PERSON_TARGET = (r"(?:your|ur|the assistant'?s|the bot'?s)\s+(?:\w+\s+){0,2}"
                        r"(?:prompt|instructions?|rules|guidelines|configuration|directives|programming|guardrails|constraints)")
INIT_TEXT = r"(?:text|words|configuration|instructions?|message|prompt|guidelines|rules|directives)\s+(?:that\s+)?(?:you\s+)?(?:were|was|are)\s+(?:given|initiali[sz]ed|configured|set up|primed|started|loaded|provided)"
OVERRIDE_VERB = r"(?:ignore|disregard|forget|override|bypass|skip|drop|abandon|discard|neglect|cancel|erase|delete|remove|suspend|turn off|disable)"
PRIOR = r"(?:all\s+|any\s+|the\s+|your\s+|my\s+|these\s+|those\s+)*(?:previous|prior|above|earlier|preceding|initial|original|existing|system|safety|old|current|default|given)?\s*"
RULE_WORDS = r"(?:instructions?|rules|guidelines|directives|prompts?|constraints|restrictions|policies|programming|commands|guardrails|filters|context)"
OTHERS = r"(?:other|another|previous|all|different|every|remaining|rest of the)\s+(?:users?|employees?|customers?|people|persons?|sessions?|accounts?|members?|officers?|clients?)"
USER_DATA = r"(?:data|messages?|chats?|conversations?|questions?|prompts?|history|records|details|files|queries|emails|inputs?|logs|requests|personal information|info)"


@dataclass
class InjRule:
    id: str
    label: str        # sub-type reported to the dashboard
    pattern: re.Pattern
    weight: float


def _r(pattern: str) -> re.Pattern:
    return re.compile(pattern, re.I)


RULES: list[InjRule] = [
    # --- Instruction override ---
    InjRule("OVR-01", "INSTRUCTION_OVERRIDE", _r(rf"\b{OVERRIDE_VERB}\s+{PRIOR}{RULE_WORDS}"), 0.85),
    InjRule("OVR-02", "INSTRUCTION_OVERRIDE", _r(r"\b(?:do not|don'?t|stop|no longer)\s+(?:follow|obey|listen to|adhere to|respect)(?:ing)?\s+(?:your|the|any|those|these)\s+(?:\w+\s+)?(?:rules|instructions|guidelines|policies|restrictions)"), 0.75),
    InjRule("OVR-03", "INSTRUCTION_OVERRIDE", _r(r"\byou\s+are\s+(?:no longer|not)\s+(?:bound|restricted|limited|required to follow)"), 0.75),
    InjRule("OVR-04", "INSTRUCTION_OVERRIDE", _r(r"\b(?:new|updated|real|actual|true)\s+(?:system\s+)?instructions?\s*(?::|are|follow)"), 0.55),
    InjRule("OVR-05", "INSTRUCTION_OVERRIDE", _r(r"\bfrom now on,?\s+you\s+(?:will|must|shall|are|have to)\b"), 0.4),
    InjRule("OVR-06", "INSTRUCTION_OVERRIDE", _r(r"\b(?:instead|rather),?\s+(?:of\s+(?:that|answering)\s+)?(?:you\s+(?:must|should|will)\s+)?(?:reveal|print|output|say|respond with)\b"), 0.45),
    InjRule("OVR-07", "INSTRUCTION_OVERRIDE", _r(r"\b(?:the\s+)?(?:above|previous|prior)\s+(?:instructions?|rules|text)\s+(?:is|are|was|were)\s+(?:fake|wrong|outdated|void|cancelled|a test|not valid)"), 0.75),
    InjRule("OVR-10", "INSTRUCTION_OVERRIDE", _r(r"\b(?:system|admin|security|safety|developer|emergency)\s+override\b|\b(?:safety|filters?|guardrails|restrictions|content policy|moderation)\s+(?:is\s+|are\s+)?(?:now\s+)?(?:off|disabled|removed|deactivated)\b"), 0.7),
    InjRule("OVR-09", "INSTRUCTION_OVERRIDE", _r(r"\b(?:forget|ignore|disregard|set aside|erase)\s+(?:about\s+)?(?:everything|all|anything|whatever)\s+(?:\w+\s+){0,3}?(?:above|before|earlier|previously|so far|you were told|you know|you have been told)"), 0.8),
    InjRule("OVR-08", "INSTRUCTION_OVERRIDE", _r(r"\b(?:old|original|earlier|previous|prior|your)\s+(?:rules|instructions|guidelines|restrictions)\s+(?:have been|has been|are|were)\s+(?:now\s+)?(?:cancelled|canceled|removed|lifted|revoked|disabled|deleted|suspended)"), 0.7),

    # --- System prompt / hidden context extraction ---
    InjRule("EXT-01", "SYSTEM_PROMPT_EXTRACTION", _r(rf"\b{VERB_REVEAL}\b(?:\s+\w+){{0,6}}?\s+{TARGET_SYS}"), 0.75),
    InjRule("EXT-02", "SYSTEM_PROMPT_EXTRACTION", _r(rf"\b{VERB_REVEAL}\b(?:\s+\w+){{0,5}}?\s+{SECOND_PERSON_TARGET}"), 0.85),
    InjRule("EXT-03", "SYSTEM_PROMPT_EXTRACTION", _r(rf"\b{INIT_TEXT}"), 0.7),
    InjRule("EXT-04", "SYSTEM_PROMPT_EXTRACTION", _r(r"\bwhat\s+(?:are|were|is)\s+(?:your|ur)\s+(?:\w+\s+)?(?:instructions?|rules|system prompt|guidelines|directives|initial prompt|configuration)"), 0.65),
    InjRule("EXT-05", "SYSTEM_PROMPT_EXTRACTION", _r(rf"\b{VERB_REVEAL}\b(?:\s+\w+){{0,4}}?\s+(?:everything|all|the text|the words|anything)(?:\s+\w+){{0,3}}\s+(?:above|before|prior to)\s+(?:this|my|the)"), 0.75),
    InjRule("EXT-06", "SYSTEM_PROMPT_EXTRACTION", _r(r"\b(?:verbatim|word for word|word-by-word|exactly as written|in full)\b.{0,60}\b(?:instructions?|prompt|configuration|initiali[sz]|rules|guidelines)|\b(?:instructions?|prompt|configuration|rules|guidelines)\b.{0,60}\b(?:verbatim|word for word|word-by-word)\b"), 0.6),
    InjRule("EXT-07", "SYSTEM_PROMPT_EXTRACTION", _r(r"\b(?:begin|start)\s+your\s+(?:reply|response|answer)\s+with\s+(?:the|your)\s+(?:system|initial|first)"), 0.7),
    InjRule("EXT-08", "SYSTEM_PROMPT_EXTRACTION", _r(r"\b(?:translate|summari[sz]e|encode|convert)\s+(?:your|the)\s+(?:system\s+)?(?:prompt|instructions|rules)\s+(?:into|to|in)\b"), 0.75),
    InjRule("EXT-10", "SYSTEM_PROMPT_EXTRACTION", _r(r"\bwhat\s+(?:did|does|do)\s+(?:the|your)\s+(?:developers?|creators?|admins?|administrators?|company|operators?|system)\s+(?:tell|instruct|ask|told|want)\s+you"), 0.7),
    InjRule("EXT-11", "SYSTEM_PROMPT_EXTRACTION", _r(r"\b(?:rules|instructions|guidelines|constraints|directives)\s+(?:that\s+)?(?:you(?:'re| are)?|u)\s+(?:currently\s+)?(?:following|bound by|operating under|programmed with|running on)"), 0.7),
    InjRule("EXT-15", "SYSTEM_PROMPT_EXTRACTION", _r(r"\bwhat\s+(?:were|are|have)\s+you\s+(?:been\s+)?(?:told|instructed|asked|programmed|configured|trained|set up)\s+(?:to|not to|with)\b"), 0.6),
    InjRule("EXT-16", "SYSTEM_PROMPT_EXTRACTION", _r(r"\b(?:your|ur)\s+(?:system\s+prompt|hidden\s+(?:prompt|instructions|rules)|initial\s+(?:prompt|instructions)|secret\s+(?:prompt|instructions|rules)|pre-?prompt)\b"), 0.55),
    InjRule("EXT-12", "SYSTEM_PROMPT_EXTRACTION", _r(r"\b(?:text|words|message|messages|content|everything|instructions)\s+(?:that\s+)?(?:came|comes|come|appears?|appeared|was|were|is|written)?\s*(?:above|before|prior to)\s+(?:this|the|my|our)\s+(?:conversation|chat|message|session|first message|prompt)"), 0.7),
    InjRule("EXT-13", "SYSTEM_PROMPT_EXTRACTION", _r(r"\b(?:repeat|print|output|copy|recite|reproduce|paste|show)\s+(?:back\s+)?(?:the\s+|all\s+(?:the\s+)?)?(?:words|text|lines|sentences|everything|content)\s+(?:written\s+)?above"), 0.75),
    InjRule("EXT-14", "SYSTEM_PROMPT_EXTRACTION", _r(r"\bstarting\s+(?:with|from)\s+['\"“]?you\s+are\b"), 0.65),
    InjRule("EXT-09", "SYSTEM_PROMPT_EXTRACTION", _r(r"\b(?:canary|secret code|reference (?:id|code)|hidden (?:token|code|key))\b.{0,30}\b(?:you|your)\b|\b(?:your|the)\s+(?:canary|secret code|hidden (?:token|code|key))"), 0.6),

    # --- Jailbreak / role-play ---
    InjRule("JB-01", "JAILBREAK_ROLEPLAY", _r(r"\bDAN\b|\bdo anything now\b"), 0.8),
    InjRule("JB-02", "JAILBREAK_ROLEPLAY", _r(r"\b(?:developer|god|admin|debug|maintenance|sudo|root|unrestricted|jailbreak|evil)\s+mode\b"), 0.65),
    InjRule("JB-03", "JAILBREAK_ROLEPLAY", _r(r"\b(?:pretend|imagine|act|behave|roleplay|role-play)\b.{0,60}\b(?:no|without|free (?:of|from)|zero|any)\s+(?:restrictions|rules|filters|limits|limitations|guidelines|ethics|censorship|guardrails)"), 0.8),
    InjRule("JB-04", "JAILBREAK_ROLEPLAY", _r(r"\byou\s+(?:have|now have)\s+no\s+(?:restrictions|rules|limits|filters|guidelines)"), 0.75),
    InjRule("JB-05", "JAILBREAK_ROLEPLAY", _r(r"\b(?:unfiltered|uncensored|unrestricted|unaligned|jailbroken)\s+(?:ai|assistant|model|version|response|mode|chatbot)"), 0.65),
    InjRule("JB-06", "JAILBREAK_ROLEPLAY", _r(r"\bjailbreak(?:ing)?\b"), 0.5),
    InjRule("JB-07", "JAILBREAK_ROLEPLAY", _r(r"\b(?:i am|i'm)\s+(?:your|the)\s+(?:developer|creator|admin|administrator|owner|system administrator)\b"), 0.55),
    InjRule("JB-09", "JAILBREAK_ROLEPLAY", _r(r"\byou\b.{0,40}\b(?:have|has|with)\s+no\s+(?:limits|limitations|restrictions|rules|filters|boundaries|guardrails)"), 0.7),
    InjRule("JB-10", "JAILBREAK_ROLEPLAY", _r(r"\byou\s+(?:now\s+)?(?:work|answer|report)\s+(?:only\s+)?(?:for|to)\s+me\b"), 0.55),
    InjRule("JB-08", "JAILBREAK_ROLEPLAY", _r(r"\b(?:answer|respond|reply|talk|speak|write)\b.{0,40}\bwithout\s+(?:any\s+|your\s+)?(?:filters?|restrictions|rules|limits|censorship|guardrails|safety)"), 0.6),

    # --- Other users' data ---
    InjRule("XU-01", "CROSS_USER_DATA_REQUEST", _r(rf"\b{OTHERS}(?:'s|s')?\s+(?:\w+\s+){{0,2}}{USER_DATA}"), 0.6),
    InjRule("XU-02", "CROSS_USER_DATA_REQUEST", _r(rf"\b(?:show|give|list|reveal|tell|display|share|fetch|dump|export|print|what (?:did|were|was))\b.{{0,40}}\b{OTHERS}"), 0.75),
    InjRule("XU-03", "CROSS_USER_DATA_REQUEST", _r(r"\b(?:last|previous|recent|earlier)\s+(?:question|prompt|message|query|chat|conversation)s?\s+(?:asked|sent|typed|made|submitted)?\s*(?:by|from|of)\s+(?!me\b)\w+"), 0.7),
    InjRule("XU-04", "CROSS_USER_DATA_REQUEST", _r(r"\b(?:dump|export|print|list|show)\s+(?:the\s+|all\s+)*(?:database|db|users? table|user records|all users|every user|employee records|customer database)"), 0.7),
    InjRule("XU-07", "CROSS_USER_DATA_REQUEST", _r(r"\b(?:user|person|employee|someone|people|officer|customer)\s+(?:who|that)\s+(?:chatted|talked|spoke|asked|was here|came|used this|logged in|wrote)\s+(?:\w+\s+)?before\s+me"), 0.75),
    InjRule("XU-08", "CROSS_USER_DATA_REQUEST", _r(r"\b(?:conversation|chat|messages|history|prompts|queries|session)s?\s+(?:of|from|with)\s+(?:the\s+)?(?:another|other|previous|last|different|next)\s+(?:user|person|employee|customer|officer)"), 0.7),
    InjRule("XU-06", "CROSS_USER_DATA_REQUEST", _r(rf"\b{OTHERS}\s+(?:\w+\s+){{0,2}}(?:asked|typed|said|wrote|searched|uploaded|sent|requested|submitted|entered)"), 0.7),
    InjRule("XU-05", "CROSS_USER_DATA_REQUEST", _r(r"\b(?:what|which)\s+(?:did|have)\s+(?:other|another)\s+(?:users?|employees?|people)\s+(?:ask|say|type|search|upload)"), 0.75),
    # Harvesting identifiers the assistant has "seen" or "stored" for other people.
    InjRule("XU-09", "CROSS_USER_DATA_REQUEST", _r(
        r"\b(?:retrieve|extract|list|give|show|return|export|dump|collect|compile|print|tell)\b.{0,60}"
        r"\b(?:aadhaar|aadhar|pans?|phone|mobile|personal|bank|account|identity)\b.{0,60}"
        r"\b(?:(?:you|you've|you\s+have)\s+(?:have\s+)?(?:seen|stored|processed|received|collected|saved)"
        r"|stored\s+(?:for|of|about)|(?:from|of|for|by)\s+(?:any|all|every|other)\s+(?:users?|employees?|citizens?|people|staff|applicants?)"
        r"|in\s+your\s+(?:memory|database|logs|records))"), 0.8),

    # --- Secrets of the deployment itself ---
    InjRule("SEC-01", "SYSTEM_PROMPT_EXTRACTION", _r(
        r"\b(?:every|all|any|each)\s+(?:\w+\s+){0,2}?(?:instructions?|secrets?|api\s*keys?|passwords?|credentials?|tokens?)\b.{0,60}"
        r"\b(?:from|in|of)\s+your\s+(?:setup|configuration|config|system|deployment|environment|instructions|prompt|memory)\b"), 0.8),

    # --- Delimiter / chat-template injection ---
    InjRule("DLM-01", "DELIMITER_INJECTION", _r(r"<\|im_start\|>|<\|im_end\|>|<\|system\|>|<\|assistant\|>|\[/?INST\]|<<\s*/?SYS\s*>>|</?\s*system\s*>|<\|begin_of_text\|>|<\|start_header_id\|>"), 0.7),
    InjRule("DLM-02", "DELIMITER_INJECTION", _r(r"(?:^|\n|\s)#{2,}\s*(?:system|new instructions?|admin|override)\b"), 0.55),
    InjRule("DLM-03", "DELIMITER_INJECTION", _r(r"\b(?:end of (?:user )?(?:input|prompt|conversation)|begin (?:system|admin) (?:prompt|message|instructions?))\b"), 0.6),

    # --- Indirect injection markers (mostly inside documents) ---
    InjRule("IND-01", "INDIRECT_INJECTION", _r(r"\b(?:note|message|instructions?|attention|important)\s+(?:to|for)\s+(?:the\s+|any\s+)?(?:ai|assistant|llm|chatbot|language model|model|gpt|copilot|bot)\b"), 0.65),
    InjRule("IND-02", "INDIRECT_INJECTION", _r(r"\bif\s+you\s+are\s+(?:an?\s+)?(?:ai|llm|large language model|language model|assistant|chatbot|bot|automated system)"), 0.7),
    InjRule("IND-03", "INDIRECT_INJECTION", _r(r"\b(?:ai|assistant|llm|model|bot)s?\s+(?:reading|processing|summari[sz]ing|analy[sz]ing|parsing)\s+this\b"), 0.7),
    InjRule("IND-04", "INDIRECT_INJECTION", _r(r"\bwhen\s+(?:you\s+)?(?:summari[sz]|process|read|analy[sz])(?:e|ing)?\s+this\s+(?:document|file|email|page|resume|cv|text)\b.{0,80}\b(?:ignore|instead|do not|don'?t|must|always|never|say|tell|rate|recommend)"), 0.65),
    InjRule("EXF-01", "DATA_EXFILTRATION", _r(r"\b(?:send|forward|email|post|upload|exfiltrate|transmit|leak|copy)\b.{0,60}\b(?:to|at|into)\s+(?:https?://|\S+@\S+\.\w+|this (?:url|link|address|webhook))"), 0.6),
    InjRule("EXF-02", "DATA_EXFILTRATION", _r(r"!\[[^\]]*\]\(https?://[^)]*[?&][^)]*=[^)]*\)"), 0.6),

    # --- Weak signals: not enough to block, but enough to ask the local Llama (grey zone) ---
    InjRule("SUS-01", "SUSPICIOUS_META_REQUEST", _r(r"\b(?:above|before this|earlier|initial|hidden|secret|internal|original)\b.{0,40}\b(?:instructions?|prompt|rules|configuration|guidelines|context)\b.{0,40}\b(?:print|show|repeat|reveal|tell|output|give|share|list)\b"), 0.3),
    InjRule("SUS-02", "SUSPICIOUS_META_REQUEST", _r(r"\b(?:print|show|repeat|reveal|tell|output|give|share|list)\b.{0,40}\b(?:above|before this|earlier|initial|hidden|secret|internal|original)\b.{0,40}\b(?:instructions?|prompt|rules|configuration|guidelines|context)\b"), 0.3),
    InjRule("SUS-03", "SUSPICIOUS_META_REQUEST", _r(r"\b(?:no|without)\s+(?:limits|restrictions|filters|rules|guardrails|censorship)\b"), 0.3),

    # --- Hinglish (romanised Hindi) ---
    InjRule("HI-01", "INSTRUCTION_OVERRIDE", _r(r"\b(?:pichh?l[eai]|purane|upar\s+wale|sabhi|saar[ei]|sare|sab|pehle\s+wale)\s+(?:\w+\s+)?(?:instructions?|nirdesh|rules|niyam|hukum|baatein)\b.{0,25}\b(?:bhool|bhul|ignore|nazar\s?andaz|chhod|chod|mat\s+maano?|mat\s+mano|hata)"), 0.85),
    InjRule("HI-02", "INSTRUCTION_OVERRIDE", _r(r"\b(?:instructions?|rules|nirdesh|niyam)\s+(?:ko\s+)?(?:bhool|bhul|ignore|nazar\s?andaz|chhod|chod)\s*(?:karo|kar\s+do|kardo|jao|ja|jaiye|do|dena)"), 0.8),
    InjRule("HI-03", "SYSTEM_PROMPT_EXTRACTION", _r(r"\b(?:system|asli|chhupe?|chupe?|hidden|secret|andar\s+ke|gupt)\s+(?:wale\s+)?(?:prompt|instructions?|nirdesh|rules|niyam)\b.{0,25}\b(?:batao|bata|btao|dikhao|dikha|bolo|likho|share\s+karo|de\s+do|bataiye|dikhaiye)\b"), 0.85),
    InjRule("HI-04", "SYSTEM_PROMPT_EXTRACTION", _r(r"\b(?:apna|apne|apni|tumhara|tumhare|tumhari|aapka|aapke|aapki|tera|tere)\s+(?:system\s+prompt|prompt|instructions?|nirdesh|rules|niyam|setup)\b.{0,25}\b(?:batao|bata|btao|dikhao|dikha|bolo|likho|share|bataiye|dikhaiye|kya\s+(?:hai|hain))"), 0.85),
    InjRule("HI-05", "CROSS_USER_DATA_REQUEST", _r(r"\b(?:dusre|doosre|baaki|baki|anya|sabhi|dusron|doosron)\s+(?:\w+\s+)?(?:users?|logon|logo|log|employees?|karmchari|karmachariyon|customers?)\s+(?:ka|ke|ki)\s+(?:\w+\s+)?(?:data|chats?|messages?|sawal|jaankari|jankari|details|history)"), 0.8),
    InjRule("HI-07", "SYSTEM_PROMPT_EXTRACTION", _r(r"\b(?:tumhe|tumhein|tujhe|aapko|apko|tumko)\b.{0,30}\b(?:instructions?|nirdesh|rules|niyam|prompt)\b.{0,30}\b(?:diye|di|mile|bataye|sikhaye)\b.{0,40}\b(?:dikhao|batao|bata|dikha|bolo|likho|share)"), 0.8),
    InjRule("HI-08", "SYSTEM_PROMPT_EXTRACTION", _r(r"\b(?:instructions?|nirdesh|prompt)\s+(?:jo|joh)\s+(?:tumhe|aapko|tujhe)\b"), 0.6),
    InjRule("HI-06", "JAILBREAK_ROLEPLAY", _r(r"\b(?:bina|koi\s+bhi)\s+(?:kisi\s+)?(?:restriction|rules?|niyam|filter|pabandi)\s+(?:ke|nahi)\b"), 0.6),

    # --- Hindi (Devanagari) ---
    InjRule("HD-01", "INSTRUCTION_OVERRIDE", _r(r"(?:पिछले|पुराने|सभी|सारे|ऊपर\s*के)\s*(?:\S+\s+)?(?:निर्देश|निर्देशों|नियम|नियमों|आदेश|आदेशों).{0,25}(?:भूल|अनदेखा|नज़रअंदाज़|नजरअंदाज|मत\s*मान|छोड़)"), 0.85),
    InjRule("HD-02", "SYSTEM_PROMPT_EXTRACTION", _r(r"(?:सिस्टम\s*प्रॉम्प्ट|सिस्टम\s*प्रांप्ट|छिपे\s*हुए?\s*निर्देश|गुप्त\s*निर्देश|अपने\s*निर्देश|आपके\s*निर्देश|तुम्हारे\s*निर्देश).{0,25}(?:बताओ|बताइए|बताएं|दिखाओ|दिखाइए|लिखो|साझा)"), 0.85),
    InjRule("HD-03", "CROSS_USER_DATA_REQUEST", _r(r"(?:दूसरे|अन्य|बाकी|सभी)\s*(?:उपयोगकर्ता(?:ओं)?|यूज़र(?:्स)?|यूजर(?:्स)?|कर्मचारि(?:यों)?|लोगों)\s*(?:का|के|की)\s*(?:डेटा|जानकारी|संदेश|सवाल|चैट)"), 0.8),
]

# Defensive / educational framing lowers the score (but never to zero).
EDUCATIONAL = _r(
    r"\b(?:what is|what are|explain|how (?:do|does|can|to|should) (?:we |i |you |an organi[sz]ation )?(?:defend|prevent|detect|protect|mitigate|stop|guard)|"
    r"how (?:to|do i|can i|should i) (?:write|create|design|build|draft|make|structure)|"
    r"examples? of|types of|awareness|training (?:slides|session|material)|research paper|define|definition of|owasp|best practices)\b"
)
# Editing instructions about the user's OWN text ("ignore the typos", "forget the earlier draft",
# "disregard formatting rules") use override verbs; the ML classifier often scores them as attacks.
BENIGN_EDIT = _r(
    r"\b(?:ignore|forget|disregard|skip|override|overlook)\s+(?:about\s+)?"
    r"(?:the\s+|my\s+|any\s+|all\s+(?:the\s+)?|this\s+|that\s+|those\s+|these\s+|our\s+)?(?:\w+\s+){0,2}?"
    r"(?:typos?|spelling(?:\s+mistakes)?|grammar|formatting(?:\s+rules)?|format|tone|style|font|layout|word\s+limit|"
    r"(?:earlier|previous|first|last|old|original)\s+(?:version|draft|email|letter|reply|answer|attempt)|"
    r"(?:first|second|third|last|previous|next|above)\s+(?:paragraph|line|section|point|sentence|page|part)|draft)\b"
)
# ...unless the rest of the prompt is about the assistant itself, its secrets or other people's data.
META_TARGET = _r(
    r"\b(?:instructions?|rules?|prompts?|system|guidelines?|configur\w*|setup|restrictions?|filters?|polic(?:y|ies)|"
    r"developers?|secrets?|confidential|hidden|passwords?|api\s*keys?|credentials?|memory|history|conversations?|"
    r"users?|employees?|before\s+me|guardrails?|safety)\b"
)


def is_benign_edit(text: str) -> bool:
    """True when the override verbs only target the user's own draft and nothing else looks like a target."""
    if not BENIGN_EDIT.search(text):
        return False
    return not META_TARGET.search(BENIGN_EDIT.sub(" ", text))


VIEW_WEIGHT = {"clean": 1.0, "collapsed": 1.0, "leet": 0.95, "decoded": 1.0, "rot13": 0.9, "reversed": 0.9}
OBFUSCATED_VIEWS = {"collapsed", "leet", "decoded", "rot13", "reversed"}


@dataclass
class InjectionResult:
    score: float
    findings: list[Finding]
    matched_rules: list[str]
    obfuscated: bool


def _noisy_or(weights: list[float]) -> float:
    p = 1.0
    for w in weights:
        p *= 1 - w
    return 1 - p


def scan(norm: NormalizedText) -> InjectionResult:
    best: dict[str, tuple[float, str, str]] = {}      # rule id -> (weight, label, view)
    for view, text in norm.views.items():
        factor = VIEW_WEIGHT.get(view, 1.0)
        for rule in RULES:
            if rule.pattern.search(text):
                w = rule.weight * factor
                if rule.id not in best or w > best[rule.id][0]:
                    best[rule.id] = (w, rule.label, view)

    if not best and not norm.hidden_chars:
        return InjectionResult(0.0, [], [], False)

    # Obfuscated = the attack was only visible after de-obfuscation, not in the plain text.
    obfuscated = bool(best) and all(view in OBFUSCATED_VIEWS for _, _, view in best.values())

    weights = [w for w, _, _ in best.values()]
    score = _noisy_or(weights)

    labels = {label for _, label, _ in best.values()}
    only_soft = labels <= {"SYSTEM_PROMPT_EXTRACTION", "JAILBREAK_ROLEPLAY", "CROSS_USER_DATA_REQUEST",
                           "SUSPICIOUS_META_REQUEST"}
    clean_text = norm.views["clean"]
    if (EDUCATIONAL.search(clean_text) and only_soft
            and not any(rid.startswith(("OVR", "HI", "HD", "DLM")) for rid in best)
            and not re.search(r"\b(?:your|ur)\b", clean_text)):
        score *= 0.5

    if norm.hidden_chars:
        score = _noisy_or([score, 0.25])
    if obfuscated:
        score = _noisy_or([score, 0.2])

    findings: list[Finding] = []
    by_label: dict[str, list[str]] = {}
    for rid, (_, label, _) in best.items():
        by_label.setdefault(label, []).append(rid)
    for label, rids in by_label.items():
        label_score = _noisy_or([best[r][0] for r in rids])
        findings.append(Finding(
            category=Category.INJECTION, type=label, severity=4 if label_score >= 0.7 else 3,
            confidence=round(label_score, 2), detector="injection-rules",
            reason="rules " + ", ".join(sorted(rids)) + (" (found after de-obfuscation)" if obfuscated else ""),
        ))
    if obfuscated:
        findings.append(Finding(
            category=Category.INJECTION, type="OBFUSCATED_PAYLOAD", severity=3, confidence=0.8,
            detector="normalizer", reason="attack text was hidden using encoding / spacing / leetspeak",
        ))
    if norm.hidden_chars:
        findings.append(Finding(
            category=Category.INJECTION, type="HIDDEN_CHARACTERS", severity=2, confidence=0.7,
            detector="normalizer", reason=f"{norm.hidden_chars} invisible characters in text",
        ))
    return InjectionResult(round(min(score, 0.99), 3), findings, sorted(best), obfuscated)
