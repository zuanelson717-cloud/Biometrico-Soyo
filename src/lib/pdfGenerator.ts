import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generatePDFContent = (doc: jsPDF, filteredData: any[], date: string) => {
    doc.text(`Relatório Diário - ${date}`, 14, 10);
    
    const tableData = filteredData.map(e => {
        const eightHoursMs = 8 * 60 * 60 * 1000;
        
        const formatDuration = (ms: number) => {
            const hrs = Math.floor(ms / (1000 * 60 * 60));
            const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
            return `${hrs}h ${mins}m`;
        };

        const totalStr = formatDuration(e.totalDurationMs);
        let durationStr = e.totalDurationMs > 0 ? totalStr : '-';
        if (e.totalDurationMs > eightHoursMs) {
            const extraTimeMs = e.totalDurationMs - eightHoursMs;
            durationStr = `${totalStr} +${formatDuration(extraTimeMs)}`;
        }
        
        return [
            e.name,
            e.nip || '-',
            e.role,
            e.pairs.map((p: any) => `Entrada: ${p.checkInStr || '-'} | Saída: ${p.checkOutStr || '-'}`).join('\n'),
            durationStr,
            e.dailyDelayMs > 0 ? formatDuration(e.dailyDelayMs) : '-'
        ];
    });

    autoTable(doc, {
        head: [['Funcionário', 'NIP', 'Cargo', 'Registros', 'Carga Horária', 'Atraso']],
        body: tableData,
    });
};
