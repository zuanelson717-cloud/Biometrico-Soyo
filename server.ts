import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import 'dotenv/config';
import PDFDocument from 'pdfkit';
import { google } from 'googleapis';
import nodemailer from 'nodemailer';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from './firebase-applet-config.json';
import cron from 'node-cron';

import fs from 'fs';

let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
    serviceAccount = JSON.parse(fs.readFileSync('./service-account.json', 'utf8'));
}

// Inicialização do Firebase Admin com credenciais dinâmicas
const app = initializeApp({
    credential: cert(serviceAccount as any),
    projectId: firebaseConfig.projectId
});
const firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);



// Função para enviar e-mail via Gmail API usando OAuth2
async function sendEmailWithGmailAPI(pdfData: Buffer, fileName: string, recipientEmails: string[], accessToken: string) {
    // ... (rest of the Gmail API function)
    try {
        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({ access_token: accessToken });

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        const emailLines = [
            `To: ${recipientEmails.join(', ')}`,
            'Content-Type: multipart/mixed; boundary="foo"',
            'MIME-Version: 1.0',
            `Subject: Relatório Automatizado: ${fileName}`,
            '',
            '--foo',
            'Content-Type: text/plain; charset="UTF-8"',
            'MIME-Version: 1.0',
            'Content-Transfer-Encoding: 7bit',
            '',
            'Segue em anexo o relatório solicitado.',
            '--foo',
            'Content-Type: application/pdf',
            'MIME-Version: 1.0',
            'Content-Transfer-Encoding: base64',
            `Content-Disposition: attachment; filename="${fileName}"`,
            '',
            pdfData.toString('base64'),
            '--foo--'
        ];

        const rawMessage = Buffer.from(emailLines.join('\r\n')).toString('base64url');

        await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: rawMessage,
            },
        });

        console.log(`E-mail com relatório ${fileName} enviado via Gmail API para ${recipientEmails.join(', ')} com sucesso.`);
    } catch (e) {
        console.error(`Erro ao enviar e-mail via Gmail API:`, e);
        throw e;
    }
}

// Função para enviar e-mail via SMTP
async function sendEmailWithSMTP(pdfData: Buffer, fileName: string, recipientEmails: string[], smtpConfig: any) {
    console.log('Iniciando envio via SMTP...');
    const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.port === 465,
        auth: {
            user: smtpConfig.user,
            pass: smtpConfig.password,
        },
    });

    console.log('Transporter criado. Enviando e-mail...');
    await transporter.sendMail({
        from: smtpConfig.senderEmail,
        to: recipientEmails.join(', '),
        subject: `Relatório Automatizado: ${fileName}`,
        text: 'Segue em anexo o relatório solicitado.',
        attachments: [
            {
                filename: fileName,
                content: pdfData,
                contentType: 'application/pdf',
            },
        ],
    });
    console.log(`E-mail com relatório ${fileName} enviado via SMTP para ${recipientEmails.join(', ')} com sucesso.`);
}

// Função para gerar e enviar relatório recebendo os dados diretamente
async function generateAndSendReportFromData(employees: any[], recipientEmails: string[], accessToken: string | null) {
    console.log('Gerando relatório a partir de dados recebidos...');
    try {
        // Função para obter configurações SMTP de variáveis de ambiente
        function getSmtpConfigFromEnv() {
            if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
                return {
                    host: process.env.SMTP_HOST,
                    port: parseInt(process.env.SMTP_PORT || '587'),
                    user: process.env.SMTP_USER,
                    password: process.env.SMTP_PASS,
                    senderEmail: process.env.SMTP_FROM || process.env.SMTP_USER
                };
            }
            return null;
        }

        console.log('Buscando configurações SMTP...');
        let smtpConfig = getSmtpConfigFromEnv();
        
        if (!smtpConfig) {
            console.log('Configurações SMTP não encontradas em variáveis de ambiente, buscando no Firestore...');
            const docRef = firestoreDb.collection('config').doc('smtpSettings');
            console.log('DocRef criado para:', docRef.path);
            
            try {
                const smtpDoc = await docRef.get();
                console.log('Get() concluído. Documento existe?', smtpDoc.exists);
                if (smtpDoc.exists) {
                    smtpConfig = smtpDoc.data() as any;
                }
            } catch (err) {
                console.error('Erro ao acessar Firestore:', err);
                throw err;
            }
        } else {
            console.log('Configurações SMTP carregadas de variáveis de ambiente.');
        }

        console.log('Configuração encontrada:', smtpConfig ? 'Sim' : 'Não');
        if (smtpConfig) {
            console.log('Dados do SMTP (sem senha):', { ...smtpConfig, password: '***' });
        } else {
            console.log('Nenhuma configuração SMTP encontrada.');
        }

        const docPDF = new PDFDocument();
        const buffers: any[] = [];
        docPDF.on('data', buffers.push.bind(buffers));
        docPDF.on('end', async () => {
            const pdfData = Buffer.concat(buffers);
            const fileName = `relatorio_diario_${new Date().toISOString().split('T')[0]}.pdf`;
            
            if (smtpConfig && smtpConfig.host && smtpConfig.user && smtpConfig.password) {
                await sendEmailWithSMTP(pdfData, fileName, recipientEmails, smtpConfig);
            } else if (accessToken) {
                await sendEmailWithGmailAPI(pdfData, fileName, recipientEmails, accessToken);
            } else {
                throw new Error('Nenhum método de envio de e-mail configurado.');
            }
        });
        
        // Cabeçalho do Relatório
        docPDF.rect(50, 40, 520, 40).fill('#2563eb');
        docPDF.fillColor('#fff').fontSize(18).font('Helvetica-Bold').text('Relatório Diário de Presenças', 60, 52);
        docPDF.fontSize(10).font('Helvetica').text(`Data de Emissão: ${new Date().toLocaleDateString('pt-PT')}`, 430, 58);
        docPDF.moveDown(2);

        // Tabela
        let y = 110;
        const drawTableHeader = (y: number) => {
            docPDF.rect(50, y, 520, 25).fill('#1e293b');
            docPDF.fillColor('#fff').fontSize(8).font('Helvetica-Bold');
            docPDF.text('Nome', 55, y + 8);
            docPDF.text('NIP', 140, y + 8);
            docPDF.text('Cargo', 175, y + 8);
            docPDF.text('Reg(E/S)', 250, y + 8);
            docPDF.text('Ref(E/S)', 350, y + 8);
            docPDF.text('Total', 450, y + 8);
            docPDF.text('Atr.', 500, y + 8);
            return y + 30;
        };

        y = drawTableHeader(y);

        employees.forEach((emp, index) => {
            if (y > 750) { docPDF.addPage(); y = drawTableHeader(50); }
            
            if (index % 2 === 0) {
                docPDF.rect(50, y, 520, 25).fill('#f8fafc');
            }
            
            docPDF.fillColor(emp.isAbsent ? '#b91c1c' : '#334155').font('Helvetica').fontSize(7);
            docPDF.text(emp.name || 'N/A', 55, y + 8, { width: 80, ellipsis: true });
            docPDF.text(emp.nip || '-', 140, y + 8);
            docPDF.text(emp.role || '-', 175, y + 8, { width: 70, ellipsis: true });
            
            const simplifyTime = (str: string) => str ? str.replace(/ (AM|PM)/, '').substring(0, 5) : '-';

            // Registros
            let xReg = 250;
            if (emp.isAbsent) {
                docPDF.font('Helvetica-Bold').text('FALTA', 250, y + 8);
            } else if (emp.pairs && emp.pairs.length > 0) {
                emp.pairs.forEach((p: any) => {
                    const checkIn = simplifyTime(p.checkInStr || '-');
                    const checkOut = simplifyTime(p.checkOutStr || '-');
                    
                    docPDF.fillColor('#059669').text(checkIn, xReg, y + 8);
                    docPDF.fillColor('#334155').text(`/${checkOut}`, xReg + 25, y + 8);
                    xReg += 80;
                });
            } else {
                docPDF.text('-', 250, y + 8);
            }

            // Refeições
            if (emp.lunchPairs && emp.lunchPairs.length > 0) {
                const timeStr = emp.lunchPairs.map(p => `${simplifyTime(p.checkInStr || '-')}/${simplifyTime(p.checkOutStr || '-')}`).join(', ');
                docPDF.text(timeStr, 350, y + 8, { width: 90 });
            } else {
                docPDF.text('-', 350, y + 8);
            }
            
            // Carga e Atraso
            const formatTime = (ms: number) => {
                if (!ms || ms <= 0) return '00h00';
                const hours = Math.floor(ms / (1000 * 60 * 60));
                const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
                return `${String(hours).padStart(2, '0')}h${String(minutes).padStart(2, '0')}m`;
            };

            docPDF.text(formatTime(emp.totalDurationMs), 450, y + 8);
            docPDF.text(formatTime(emp.dailyDelayMs), 500, y + 8);
            
            y += 25;
        });

        docPDF.end();
    } catch (e) {
        console.error(`Erro ao gerar relatório:`, e);
        throw e;
    }
}
// ... rest of the file

// Função para verificar se é dia útil em Angola
function isWorkingDay(date: Date): boolean {
    const day = date.getDay();
    if (day === 0 || day === 6) return false;

    const month = date.getMonth() + 1;
    const dayOfMonth = date.getDate();

    // Feriados Angolanos (Mês-Dia)
    const holidays = [
        '1-1', '1-4', '3-8', '4-4', '5-1', '9-17', '11-11', '12-25'
    ];

    return !holidays.includes(`${month}-${dayOfMonth}`);
}

async function startServer() {
    const app = express();

    // Rota para receber os dados e disparar o e-mail
    app.post('/api/enviar-relatorio', express.json(), async (req, res) => {
        const { employees, emails, accessToken } = req.body;
        console.log('API Request received. Employees:', employees?.length, 'Emails:', emails);
        if (!employees || !emails || !Array.isArray(emails) || emails.length === 0) {
            console.log('API Request error: Missing data.');
            return res.status(400).send('Dados ou e-mails faltando.');
        }
        try {
            await generateAndSendReportFromData(employees, emails, accessToken || null);
            res.status(200).send('Relatório sendo processado.');
        } catch (e) {
            res.status(500).send('Erro ao enviar relatório.');
        }
    });

    // Rota para o Cloud Scheduler disparar o relatório diário
    app.post('/api/cron-daily-report', async (req, res) => {
        console.log('Disparando relatório diário via Cloud Scheduler...');
        try {
            // Buscar e-mail do admin
            const emailDoc = await firestoreDb.collection('config').doc('emailSettings').get();
            const emails = emailDoc.exists ? (emailDoc.data() as any)?.emails : null;
            if (!emails || emails.length === 0) {
                return res.status(400).send('Nenhum e-mail de administrador configurado.');
            }

            // Buscar funcionários e ponto
            const employeesSnap = await firestoreDb.collection('employees').get();
            const employees = employeesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            const todayStr = new Date().toISOString().split('T')[0];
            const attSnap = await firestoreDb.collection('attendance').get();
            const attendance = attSnap.docs.map(d => ({ ...d.data(), id: d.id })) as any[];

            // Processar status
            const processedEmployees = employees.map((emp: any) => {
                const records = attendance
                    .filter(a => a.employeeId === emp.id && a.timestamp?.toDate().toISOString().split('T')[0] === todayStr)
                    .sort((a: any, b: any) => a.timestamp?.toMillis() - b.timestamp?.toMillis());
                
                const pairs: any[] = [];
                const lunchPairs: any[] = [];
                let currentPair: any = {};
                let currentLunchPair: any = {};

                records.forEach(r => {
                    const time = r.timestamp?.toDate().toLocaleTimeString();
                    const date = r.timestamp?.toDate();
                    if (r.type === 'checkIn') {
                        if (currentPair.checkIn) pairs.push(currentPair);
                        currentPair = { checkIn: date, checkInStr: time };
                    } else if (r.type === 'checkOut') {
                        currentPair.checkOut = date;
                        currentPair.checkOutStr = time;
                        pairs.push(currentPair);
                        currentPair = {};
                    } else if (r.type === 'lunchIn') {
                        if (currentLunchPair.checkIn) lunchPairs.push(currentLunchPair);
                        currentLunchPair = { checkIn: date, checkInStr: time };
                    } else if (r.type === 'lunchOut') {
                        currentLunchPair.checkOut = date;
                        currentLunchPair.checkOutStr = time;
                        lunchPairs.push(currentLunchPair);
                        currentLunchPair = {};
                    }
                });
                return { ...emp, pairs, lunchPairs }; 
            });

            await generateAndSendReportFromData(processedEmployees, emails, null);
            res.status(200).send('Relatório enviado.');
        } catch (e) {
            console.error('Erro ao processar relatório diário:', e);
            res.status(500).send('Erro interno.');
        }
    });

    // Rota para ativar/desativar agendamento automático
    app.post('/api/toggle-auto-report', express.json(), async (req, res) => {
        const { enabled, reportTime } = req.body;
        try {
            await firestoreDb.collection('config').doc('autoReportSettings').set({
                enabled,
                reportTime,
                updatedAt: new Date()
            });
            res.status(200).send({ success: true });
        } catch (e) {
            console.error('Erro ao configurar agendamento automático:', e);
            res.status(500).send('Erro ao configurar agendamento.');
        }
    });

    // Agendador (cron job) - Diário
    cron.schedule('* * * * *', async () => {
        console.log('Cron Job executando...');
        try {
            const configDoc = await firestoreDb.collection('config').doc('autoReportSettings').get();
            const configData = configDoc.exists ? configDoc.data() : null;
            
            if (configData && configData.enabled) {
                const now = new Date();
                const reportTime = configData.reportTime || '00:00';
                const [targetHour, targetMinute] = reportTime.split(':').map(Number);
                
                console.log(`Cron Check: Server Time ${now.getHours()}:${now.getMinutes()}, Target Time ${targetHour}:${targetMinute}`);

                // Verifica se está no horário configurado (ajustado para Angola UTC+01:00)
                const options = { timeZone: 'Africa/Luanda', hour: '2-digit', minute: '2-digit', hour12: false };
                const localTimeStr = now.toLocaleTimeString('en-GB', options); // Retorna 'HH:MM'
                const [currentHour, currentMinute] = localTimeStr.split(':').map(Number);
                
                console.log(`Cron Check: Angola Time ${currentHour}:${currentMinute}, Target Time ${targetHour}:${targetMinute}`);

                if (currentHour !== targetHour || currentMinute !== targetMinute) {
                    return;
                }

                const today = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
                if (configData.lastRunDate === today) {
                    console.log('Relatório diário de hoje já foi enviado. Pulando...');
                    return;
                }

                console.log('Agendamento diário ativado. Iniciando processamento...');
                
                // Buscar e-mail do admin
                const emailDoc = await firestoreDb.collection('config').doc('emailSettings').get();
                const emails = emailDoc.exists ? (emailDoc.data() as any)?.emails : null;
                if (!emails || emails.length === 0) return;

                // Buscar funcionários
                const employeesSnap = await firestoreDb.collection('employees').get();
                const employees = employeesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                // Buscar ponto do dia
                const todayStr = new Date().toISOString().split('T')[0];
                const attSnap = await firestoreDb.collection('attendance').get();
                const attendance = attSnap.docs.map(d => ({ ...d.data(), id: d.id })) as any[];

                // Processar status
                const processedEmployees = employees.map((emp: any) => {
                    const records = attendance
                        .filter(a => a.employeeId === emp.id && a.timestamp?.toDate().toISOString().split('T')[0] === todayStr)
                        .sort((a: any, b: any) => a.timestamp?.toMillis() - b.timestamp?.toMillis());
                    
                    const pairs: any[] = [];
                    const lunchPairs: any[] = [];
                    let currentPair: any = {};
                    let currentLunchPair: any = {};

                    records.forEach(r => {
                        const time = r.timestamp?.toDate().toLocaleTimeString();
                        const date = r.timestamp?.toDate();
                        if (r.type === 'checkIn') {
                            if (currentPair.checkIn) pairs.push(currentPair);
                            currentPair = { checkIn: date, checkInStr: time };
                        } else if (r.type === 'checkOut') {
                            currentPair.checkOut = date;
                            currentPair.checkOutStr = time;
                            pairs.push(currentPair);
                            currentPair = {};
                        } else if (r.type === 'lunchIn') {
                            if (currentLunchPair.checkIn) lunchPairs.push(currentLunchPair);
                            currentLunchPair = { checkIn: date, checkInStr: time };
                        } else if (r.type === 'lunchOut') {
                            currentLunchPair.checkOut = date;
                            currentLunchPair.checkOutStr = time;
                            lunchPairs.push(currentLunchPair);
                            currentLunchPair = {};
                        }
                    });
                    
                    // Cálculos de tempo (Carga e Atraso)
                    let totalDurationMs = 0;
                    pairs.forEach(p => { if (p.checkIn && p.checkOut) totalDurationMs += (p.checkOut.getTime() - p.checkIn.getTime()); });
                    
                    let dailyDelayMs = 0;
                    if (pairs.length > 0 && pairs[0].checkIn) {
                        const shiftStart = new Date(pairs[0].checkIn);
                        shiftStart.setHours(8, 0, 0, 0); // Exemplo: entrada 8h
                        if (pairs[0].checkIn > shiftStart) {
                            dailyDelayMs = pairs[0].checkIn.getTime() - shiftStart.getTime();
                        }
                    }

                    const isWorking = isWorkingDay(new Date());
                    const isAbsent = isWorking && pairs.length === 0 && lunchPairs.length === 0;

                    return { ...emp, pairs, lunchPairs, isAbsent, totalDurationMs, dailyDelayMs }; 
                });

                await generateAndSendReportFromData(processedEmployees, emails, null);
                
                // Atualizar data de execução
                await firestoreDb.collection('config').doc('autoReportSettings').update({
                    lastRunDate: today
                });
                
                console.log('Relatório diário automático enviado.');
            }
        } catch (e) {
            console.error('Erro no agendador diário:', e);
        }
    });

    // Agendador (cron job) - Mensal (dia 1, meia-noite)
    cron.schedule('0 0 1 * *', async () => {
        console.log('Iniciando processamento do relatório mensal...');
        // TODO: Implementar lógica de agregação mensal e envio
    });

    // Vite middleware for development or static serving for production
    if (process.env.NODE_ENV === 'development') {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);
    } else {
        // Resolve dist path relative to current working directory
        const distPath = path.resolve(process.cwd(), 'dist');
        console.log('Serving static files from:', distPath);
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    app.listen(3000, '0.0.0.0', () => {
        console.log('Server running on port 3000');
    });
}

startServer();
