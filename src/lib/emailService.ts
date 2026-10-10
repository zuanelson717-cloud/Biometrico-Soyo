
// Function to send email using Gmail API with attachment support
export const sendEmail = async (
  accessToken: string,
  to: string,
  subject: string,
  body: string,
  pdfBase64?: string,
  filename?: string
) => {
  const boundary = 'foo_bar_baz';
  
  const b64EncodeUnicode = (str: string) => {
      return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
          function toSolidBytes(match, p1) {
              return String.fromCharCode(parseInt('0x' + p1, 16));
      }));
  };

  const encodedSubject = `=?UTF-8?B?${b64EncodeUnicode(subject)}?=`;
  
  let message = [
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    body,
    '',
  ].join('\r\n');

  if (pdfBase64 && filename) {
    message += [
      `--${boundary}`,
      `Content-Type: application/pdf; name="${filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${filename}"`,
      '',
      pdfBase64,
      '',
      `--${boundary}--`
    ].join('\r\n');
  }

  const encodedMessage = b64EncodeUnicode(message)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: encodedMessage,
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Failed to send email: ${errorData.error.message}`);
  }

  return await response.json();
};
