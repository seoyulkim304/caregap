# CareGap 프로토타입

신규간호사 근무 시뮬레이션. AI 기능(원인 대화·인계 질문·부탁 문장 피드백·AI 해설·1·2차 비교 해설)은
우리 서버의 `/api/claude`를 거쳐 Claude API를 호출합니다. **API 키는 서버 환경변수에만 있고 브라우저로 보내지 않아요.**

## 폴더 구조
```
public/index.html          프론트엔드 (정적 파일)
lib/claude-handler.js      Claude API 중계 로직 (모든 환경 공통)
api/claude.js              Vercel 함수 진입점
functions/api/claude.js    Cloudflare Pages Functions 진입점
dev-server.js              로컬 테스트 서버
vercel.json / wrangler.toml 배포 설정
```

## 로컬 실행
```
npm install
cp .env.example .env    # .env 에 ANTHROPIC_API_KEY 입력
npm run dev             # http://localhost:3000
```

## Vercel 배포
1. GitHub에 올린 뒤 Vercel에서 Import (Framework Preset: **Other**, 빌드 명령 없음). 또는 CLI: `npx vercel`
2. Project Settings → Environment Variables 에 `ANTHROPIC_API_KEY` 추가 (Production·Preview)
3. 재배포. `vercel.json`이 `public/`을 정적 파일로, `api/claude.js`를 함수(최대 120초)로 설정합니다.

## Cloudflare Pages 배포
1. `npx wrangler pages project create caregap`
2. `npx wrangler pages secret put ANTHROPIC_API_KEY --project-name caregap`
3. `npm run deploy:cloudflare`
   (Git 연동 시: 빌드 명령 `npm install`, 출력 디렉터리 `public`, 환경변수에 `ANTHROPIC_API_KEY`를 **Secret**으로 추가)

## 환경변수
| 이름 | 기본값 | 설명 |
|---|---|---|
| `ANTHROPIC_API_KEY` | (필수) | 없으면 페이지가 '준비된 대화'로 동작 |
| `CLAUDE_MODEL` | `claude-opus-5-5` | 사용할 모델 |
| `CLAUDE_EFFORT_DEFAULT` | `medium` | 원인 대화·AI 해설·비교 해설 |
| `CLAUDE_EFFORT_QUICK` | `low` | 인계 질문·부탁 문장 피드백 |
| `ALLOWED_ORIGINS` | (같은 도메인만) | 다른 도메인에서 페이지를 띄울 때 쉼표로 추가 |

## 보안 메모
- 엔드포인트는 같은 출처(Origin)의 요청만 받습니다. 브라우저 밖(curl 등) 호출까지 막지는 못하니,
  공개 배포 전 **Vercel Firewall** 또는 **Cloudflare 속도 제한 규칙**으로 `/api/claude`에 요청 수 제한을 거세요.
- Anthropic Console에서 이 키에 월 사용 한도를 걸어 두는 것을 권장합니다.
