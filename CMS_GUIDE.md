# MycoDx Pages CMS 사용 가이드

이 문서는 개발자가 아닌 직원도 제품, 소식, 갤러리 컨텐츠를 업로드할 수 있도록 정리한 운영 가이드입니다.

## 접속 전 준비

- GitHub 계정이 필요합니다.
- MycoDx 홈페이지 저장소 접근 권한이 필요합니다.
- 처음 사용할 때는 저장소 소유자 또는 관리자가 Pages CMS GitHub App을 설치해야 합니다.
- Pages CMS 공식 앱 주소는 https://app.pagescms.org 입니다.

## 접속 방법

1. https://app.pagescms.org 에 접속합니다.
2. `Sign in with GitHub`로 로그인합니다.
3. MycoDx 홈페이지 저장소를 선택합니다.
4. `Website content` 메뉴로 들어갑니다.
5. `Products`, `News`, `Gallery` 중 수정할 메뉴를 선택합니다.

## 저장과 배포

- 항목을 추가하거나 수정한 뒤 `Save`를 누르면 GitHub 저장소에 변경사항이 저장됩니다.
- 저장 후 실제 홈페이지 반영까지는 배포 시간이 조금 걸릴 수 있습니다.
- 저장 직후 홈페이지에서 바로 안 보이면 몇 분 뒤 새로고침해서 확인합니다.

## 공통 입력 규칙

- `ID`는 항목을 구분하는 내부 이름입니다.
  - 예: `website-launch`, `tb-diagnostic-kit`, `lab-culture-01`
  - 영어 소문자, 숫자, 하이픈만 사용하는 것을 권장합니다.
- `Show on site`가 켜져 있어야 홈페이지에 노출됩니다.
- 한국어와 영어 필드는 둘 다 입력하는 것을 권장합니다.
- 이미지는 너무 큰 원본을 그대로 올리기보다 웹용으로 줄인 이미지를 권장합니다.
  - 권장 형식: `jpg`, `png`, `webp`
  - 권장 가로 크기: 1600px 이하

## Products 업로드

제품 정보는 `Products`에서 관리합니다.

필드 설명:

- `ID`: 제품 고유 ID
- `Show on site`: 홈페이지 노출 여부
- `Featured`: 주요 제품 강조 여부
- `Display order`: 정렬 순서. 숫자가 작을수록 먼저 표시됩니다.
- `Category`: 제품 분류
- `Product image`: 제품 이미지
- `Title / Korean`: 한국어 제품명
- `Title / English`: 영어 제품명
- `Summary / Korean`: 한국어 제품 설명
- `Summary / English`: 영어 제품 설명
- `Tags`: 키워드 또는 특징

현재 제품 항목이 없으면 홈페이지에는 기존처럼 “제품 정보를 준비하고 있습니다.” 안내가 표시됩니다.

## News 업로드

회사 소식과 공지사항은 `News`에서 관리합니다.

필드 설명:

- `ID`: 소식 고유 ID
- `Show on site`: 홈페이지 노출 여부
- `Date`: 게시 날짜
- `Category`: `News`, `Notice`, `Press`, `Exhibition` 중 선택
- `Featured image`: 대표 이미지
- `Title / Korean`: 한국어 제목
- `Title / English`: 영어 제목
- `Summary / Korean`: 한국어 요약
- `Summary / English`: 영어 요약
- `Featured image alt text`: 대표 사진 설명 (한국어·영어)
- `Body`: 상세 본문 (한국어·영어). 빈 줄로 문단을 구분합니다. HTML이나 Markdown 대신 일반 텍스트를 입력합니다.
- `Photos`: 사진을 여러 장 추가할 수 있습니다. 각 사진의 `Photo`, `Alt text`(대체 텍스트), `Caption`(선택 설명)을 입력합니다. 입력한 순서대로 표시됩니다.
- `Link URL`: 관련 외부 기사 주소 (`https://` 또는 `http://`)

모든 소식 카드는 `/news/ID` 상세 페이지로 연결됩니다. `ID`는 고유해야 하며, 게시 후 변경하면 기존 상세 주소가 바뀝니다. `Link URL`은 상세 페이지의 관련 링크로 표시되며 새 창으로 열립니다.

본문이나 사진이 없으면 해당 영역은 표시되지 않습니다. `Show on site`를 끄면 목록과 상세 페이지 모두 숨겨집니다. 행사 소식은 요약에 행사 개요를, 본문에 참가 내용과 후기를 적고 `Photos`에 현장 사진과 캡션을 추가하세요.

## Gallery 업로드

갤러리 이미지는 `Gallery`에서 미리 관리할 수 있습니다.

필드 설명:

- `ID`: 이미지 고유 ID
- `Show on site`: 홈페이지 노출 여부
- `Display order`: 정렬 순서. 숫자가 작을수록 먼저 표시됩니다.
- `Gallery image`: 갤러리 이미지
- `Alt text / Korean`: 이미지 대체 텍스트
- `Alt text / English`: 영어 이미지 대체 텍스트
- `Caption / Korean`: 한국어 캡션
- `Caption / English`: 영어 캡션

현재 홈페이지에서는 갤러리 메뉴가 아직 노출되지 않도록 라우트가 막혀 있습니다. 컨텐츠는 미리 업로드할 수 있고, 나중에 갤러리 메뉴를 열면 입력한 항목들이 표시됩니다.

## 이미지 업로드 위치

Pages CMS에서 이미지를 업로드하면 아래 경로에 저장됩니다.

- 제품 이미지: `public/uploads/products`
- 뉴스 이미지: `public/uploads/news`
- 갤러리 이미지: `public/uploads/gallery`

홈페이지에는 `/uploads/...` 경로로 연결됩니다.

## 수정 전 확인 체크리스트

- 한국어/영어 제목과 설명을 모두 입력했는지 확인합니다.
- 노출하려는 항목은 `Show on site`가 켜져 있는지 확인합니다.
- 이미지가 깨지지 않는지 저장 후 홈페이지에서 확인합니다.
- 날짜, 카테고리, 링크 URL이 정확한지 확인합니다.
- 공개하면 안 되는 개발 중 제품 정보는 `Show on site`를 끄거나 항목을 만들지 않습니다.

## 문제가 생겼을 때

- 저장했는데 화면에 안 보이면 `Show on site`가 켜져 있는지 확인합니다.
- 이미지가 안 보이면 이미지 필드가 비어 있거나 업로드가 완료되지 않았을 수 있습니다.
- 홈페이지 반영이 늦으면 배포가 끝날 때까지 몇 분 기다립니다.
- 실수로 잘못 저장했다면 개발 담당자에게 어떤 메뉴와 항목을 수정했는지 알려주세요.
