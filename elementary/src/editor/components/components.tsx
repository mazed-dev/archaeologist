import styled from '@emotion/styled'

const kParagraphMarginStyles = `
  margin-top: 0;
  margin-bottom: 0.8em;
  &:last-child {
    margin-bottom: 0;
  }
`
export const InlineLink = styled.a`
  font-weight: 500;
  text-decoration-line: none;

  &:hover {
    text-decoration-line: underline;
    cursor: pointer;
  }
`

export const BlockQuoteBox = styled.div`
  padding: 6px 0 6px 0;
  ${kParagraphMarginStyles}

  border-radius: 5px;
  font-style: italic;
`

export const BlockQuotePad = styled.blockquote`
  padding: 0 8px 0 8px;
  margin: 0 0 0 8px;
  border-left: 1px solid rgba(0, 110, 237, 0.42);
  color: rgb(92, 92, 92);
  line-height: 142%;
`

export const CodeBlockBox = styled.code`
  padding: 4px 12px 4px 12px;

  background-color: rgb(246, 248, 248);
  color: black;

  direction: ltr;
  font-weight: 400;
  display: block;

  &:first-of-type {
    border-radius: 6px 6px 0 0;
  }

  &:last-of-type {
    border-radius: 0 0 6px 6px;
  }

  ${kParagraphMarginStyles}
`

export const DateTimePill = styled.span`
  color: #fff;
  background-color: #6c757d;

  border-radius: 10em;

  display: inline-block;

  padding-top: 0;
  padding-bottom: 0;
  padding-right: 0.6em;
  padding-left: 0.6em;

  margin-bottom: 0;
  margin-top: 0;
  margin-right: 0.2em;
  margin-left: 0.2em;

  font-weight: 600;

  white-space: nowrap;
  vertical-align: baseline;

  transition: color 0.15s ease-in-out, background-color 0.15s ease-in-out,
    border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;

  &:before {
    content: '📅 ';
    margin-right: 0.2em;
  }
`

export const HorizontalRule = styled.div`
  display: block;
  width: 100%;
  border: 0;
  height: 1px;
  background-image: linear-gradient(
    to right,
    rgba(0, 0, 0, 0),
    rgba(0, 0, 0, 0.312),
    rgba(0, 0, 0, 0)
  );
  ${kParagraphMarginStyles}
`

export const Header1Box = styled.h6`
  font-size: 1.6em;
  font-weight: 500;
  display: block;

  /* color: #1a4301; */
  color: #004b23;

  ${kParagraphMarginStyles}
`

export const Header2Box = styled.h6`
  font-size: 1.4em;
  font-weight: 500;
  /* color: #245501; */
  color: #006400;
  display: block;

  ${kParagraphMarginStyles}
`

export const Header3Box = styled.h6`
  font-size: 1.2em;
  font-weight: 500;
  /* color: #538d22; */
  color: #007200;
  display: block;

  ${kParagraphMarginStyles}
`

export const Header4Box = styled.h6`
  font-size: 1.1em;
  font-weight: 500;
  /* color: #73a942; */
  color: #008000;
  display: block;

  ${kParagraphMarginStyles}
`

export const Header5Box = styled.h6`
  font-size: 1.1em;
  font-weight: 500;
  /* color: #aad576; */
  color: #38b000;
  display: block;

  ${kParagraphMarginStyles}
`

export const Header6Box = styled.h6`
  font-size: 1.1em;
  font-weight: 500;
  /* color: #aad576; */
  color: #70e000;
  display: block;

  ${kParagraphMarginStyles}
`

const kColourCodeBg = 'rgba(27, 31, 35, 0.05)'
const kColourCodeFg = 'rgb(36, 41, 46)'

export const InlineCodeBox = styled.code`
  padding: 0.2em 0.4em;
  margin: 0;
  font-size: 85%;
  background-color: ${kColourCodeBg};
  color: ${kColourCodeFg};
  border-radius: 6px;
`

export const CheckItemBox = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  & + & {
    margin-top: 0;
  }
`

export const CheckBoxBox = styled.span`
  margin-right: 0.75em;
`

export const CheckLineBox = styled.span`
  flex: 1;
  opacity: 1;
  text-decoration: 'line-through';
  &:focus {
    outline: none;
  }
`
export const CheckLineCheckedBox = styled(CheckLineBox)`
  opacity: 0.666;
  text-decoration: 'none';
`

export const OrderedListBox = styled.ol`
  padding-left: 1.5em;
`

export const UnorderedListBox = styled.ul`
  padding-left: 2em;
`

export const ListItemBox = styled.li`
  padding-left: 0.8em;
`

export const ParagraphBox = styled.p`
  white-space: pre-wrap;
  display: block;

  ${kParagraphMarginStyles}
`
