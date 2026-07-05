import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";

Font.register({
  family: 'Roboto',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxP.ttf' },
    { src: 'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc9.ttf', fontWeight: 'bold' },
  ],
});

const styles = StyleSheet.create({
  page: { padding: 30, fontFamily: 'Roboto' },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 10 },
  desc: { fontSize: 12, marginBottom: 8, lineHeight: 1.5 },
  feature: { fontSize: 11, marginBottom: 4 },
  keyword: { fontSize: 10, marginBottom: 2, color: "#2563eb" },
});

export default function CardPDF({ data }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{data.title}</Text>
        <Text style={styles.desc}>{data.description}</Text>
        <Text style={{ fontSize: 14, marginTop: 10, fontWeight: "bold" }}>Характеристики:</Text>
        {data.features.map((f, i) => <Text key={i} style={styles.feature}>• {f}</Text>)}
        <Text style={{ fontSize: 14, marginTop: 10, fontWeight: "bold" }}>Ключевые слова:</Text>
        {data.keywords.map((k, i) => <Text key={i} style={styles.keyword}>#{k}</Text>)}
      </Page>
    </Document>
  );
}
