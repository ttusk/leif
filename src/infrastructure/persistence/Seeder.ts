import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { CreateContestUseCase } from "@/application/use-cases/CreateContestUseCase";
import { CreateStudyItemUseCase } from "@/application/use-cases/CreateStudyItemUseCase";
import { CreateSubjectUseCase } from "@/application/use-cases/CreateSubjectUseCase";
import { CreateTopicUseCase } from "@/application/use-cases/CreateTopicUseCase";
import { LinkQuestionNotebookUseCase } from "@/application/use-cases/LinkQuestionNotebookUseCase";
import { RegisterStudySessionUseCase } from "@/application/use-cases/RegisterStudySessionUseCase";
import { SetActiveContestUseCase } from "@/application/use-cases/SetActiveContestUseCase";
import { UpdateContestWallUseCase } from "@/application/use-cases/UpdateContestWallUseCase";
import type { StudyItem } from "@/domain/entities/StudyItem";
import { StudySessionType } from "@/domain/entities/StudySession";
import type { Subject } from "@/domain/entities/Subject";
import type { Topic } from "@/domain/entities/Topic";
import { EntityRepositoryFactory } from "@/infrastructure/persistence/EntityRepositoryFactory";

export interface SeededContest {
  id: string;
  name: string;
  subjects: SeededSubject[];
}

export interface SeededSubject {
  id: string;
  name: string;
  items: StudyItem[];
  topics: Topic[];
}

interface SeedContestSpec {
  id: string;
  name: string;
  wall: {
    noticeLabel: string;
    noticeUrl: string;
    examLabel: string;
    examUrl: string;
    notes: string;
  };
  subjects: SeedSubjectSpec[];
}

interface SeedSubjectSpec {
  id: string;
  name: string;
  plannedStudyMinutes: number;
  items: SeedItemSpec[];
  topics: SeedTopicSpec[];
  sessions: SeedSessionSpec[];
}

interface SeedItemSpec {
  title: string;
  weight: number;
  questionCount: number;
  totalPages: number;
}

interface SeedTopicSpec {
  id: string;
  name: string;
  notebookName: string;
  notebookUrl: string;
}

interface SeedSessionSpec {
  item: number;
  topic: number;
  type: StudySessionType;
  date: string;
  count: number;
  correct?: number;
}

const DEMO_CONTESTS: SeedContestSpec[] = [
  {
    id: "tce-sp-2026",
    name: "TCE-SP Auditor 2026",
    wall: {
      noticeLabel: "Edital TCE-SP Auditor 2026",
      noticeUrl: "https://www.tcesp.org.br",
      examLabel: "Prova TCE-SP 2023",
      examUrl: "https://www.tcesp.org.br",
      notes: "Priorizar Português, Constitucional e Controle Externo. Meta: 80 questões por dia."
    },
    subjects: [
      {
        id: "tce-portuguese",
        name: "Português",
        plannedStudyMinutes: 90,
        items: [
          { title: "Interpretação de textos", weight: 3, questionCount: 60, totalPages: 110 },
          { title: "Sintaxe", weight: 2, questionCount: 45, totalPages: 85 }
        ],
        topics: [
          {
            id: "tce-portuguese-interpretation",
            name: "Compreensão e interpretação",
            notebookName: "Tec - Português TCE",
            notebookUrl: "https://tec.example.com/tce-portugues"
          },
          {
            id: "tce-portuguese-syntax",
            name: "Concordância e regência",
            notebookName: "QConcursos - Sintaxe TCE",
            notebookUrl: "https://qconcursos.example.com/tce-sintaxe"
          }
        ],
        sessions: [
          { item: 0, topic: 0, type: "pdf", date: "2026-06-01", count: 28 },
          { item: 0, topic: 0, type: StudySessionType.QUESTIONS, date: "2026-06-01", count: 40, correct: 34 },
          { item: 1, topic: 1, type: "pdf", date: "2026-06-03", count: 22 },
          { item: 1, topic: 1, type: StudySessionType.QUESTIONS, date: "2026-06-04", count: 35, correct: 30 }
        ]
      },
      {
        id: "tce-constitutional",
        name: "Direito Constitucional",
        plannedStudyMinutes: 100,
        items: [
          { title: "Direitos fundamentais", weight: 3, questionCount: 50, totalPages: 95 },
          { title: "Organização do Estado", weight: 2, questionCount: 35, totalPages: 70 }
        ],
        topics: [
          {
            id: "tce-constitutional-rights",
            name: "Direitos e garantias fundamentais",
            notebookName: "Tec - Direitos Fundamentais",
            notebookUrl: "https://tec.example.com/direitos-fundamentais"
          },
          {
            id: "tce-constitutional-state",
            name: "Organização político-administrativa",
            notebookName: "QConcursos - Organização do Estado",
            notebookUrl: "https://qconcursos.example.com/organizacao-estado"
          }
        ],
        sessions: [
          { item: 0, topic: 0, type: "pdf", date: "2026-06-02", count: 24 },
          { item: 0, topic: 0, type: StudySessionType.QUESTIONS, date: "2026-06-02", count: 30, correct: 25 },
          { item: 1, topic: 1, type: "video", date: "2026-06-05", count: 1 },
          { item: 1, topic: 1, type: StudySessionType.QUESTIONS, date: "2026-06-06", count: 25, correct: 20 }
        ]
      },
      {
        id: "tce-external-control",
        name: "Controle Externo",
        plannedStudyMinutes: 80,
        items: [
          { title: "Tribunais de Contas", weight: 3, questionCount: 45, totalPages: 90 },
          { title: "Fiscalização contábil", weight: 2, questionCount: 30, totalPages: 65 }
        ],
        topics: [
          {
            id: "tce-control-courts",
            name: "Competências dos Tribunais de Contas",
            notebookName: "Tec - Controle Externo",
            notebookUrl: "https://tec.example.com/controle-externo"
          },
          {
            id: "tce-control-audit",
            name: "Auditoria governamental",
            notebookName: "Estratégia - Auditoria TCE",
            notebookUrl: "https://estrategia.example.com/auditoria-tce"
          }
        ],
        sessions: [
          { item: 0, topic: 0, type: "pdf", date: "2026-06-07", count: 18 },
          { item: 0, topic: 0, type: StudySessionType.QUESTIONS, date: "2026-06-07", count: 20, correct: 17 },
          { item: 1, topic: 1, type: "pdf", date: "2026-06-08", count: 20 },
          { item: 1, topic: 1, type: StudySessionType.QUESTIONS, date: "2026-06-08", count: 18, correct: 14 }
        ]
      }
    ]
  },
  {
    id: "sefaz-sp-2026",
    name: "SEFAZ-SP Fiscal 2026",
    wall: {
      noticeLabel: "Edital SEFAZ-SP Fiscal 2026",
      noticeUrl: "https://portal.fazenda.sp.gov.br",
      examLabel: "Prova SEFAZ-SP 2013",
      examUrl: "https://portal.fazenda.sp.gov.br",
      notes: "Ciclo pesado em legislação tributária, contabilidade e matemática financeira."
    },
    subjects: [
      {
        id: "sefaz-tax-law",
        name: "Legislação Tributária",
        plannedStudyMinutes: 120,
        items: [
          { title: "ICMS paulista", weight: 4, questionCount: 80, totalPages: 140 },
          { title: "Crédito tributário", weight: 3, questionCount: 55, totalPages: 100 }
        ],
        topics: [
          {
            id: "sefaz-tax-icms",
            name: "Hipóteses de incidência do ICMS",
            notebookName: "Tec - ICMS SP",
            notebookUrl: "https://tec.example.com/icms-sp"
          },
          {
            id: "sefaz-tax-credit",
            name: "Lançamento e crédito tributário",
            notebookName: "QConcursos - Crédito Tributário",
            notebookUrl: "https://qconcursos.example.com/credito-tributario"
          }
        ],
        sessions: [
          { item: 0, topic: 0, type: "pdf", date: "2026-06-01", count: 35 },
          { item: 0, topic: 0, type: StudySessionType.QUESTIONS, date: "2026-06-01", count: 45, correct: 36 },
          { item: 1, topic: 1, type: "pdf", date: "2026-06-04", count: 30 },
          { item: 1, topic: 1, type: StudySessionType.QUESTIONS, date: "2026-06-05", count: 35, correct: 28 }
        ]
      },
      {
        id: "sefaz-accounting",
        name: "Contabilidade",
        plannedStudyMinutes: 90,
        items: [
          { title: "Demonstrações contábeis", weight: 3, questionCount: 60, totalPages: 120 },
          { title: "Análise de balanços", weight: 2, questionCount: 40, totalPages: 85 }
        ],
        topics: [
          {
            id: "sefaz-accounting-statements",
            name: "Balanço patrimonial e DRE",
            notebookName: "Tec - Contabilidade Geral",
            notebookUrl: "https://tec.example.com/contabilidade-geral"
          },
          {
            id: "sefaz-accounting-analysis",
            name: "Índices financeiros",
            notebookName: "QConcursos - Análise de Balanços",
            notebookUrl: "https://qconcursos.example.com/analise-balancos"
          }
        ],
        sessions: [
          { item: 0, topic: 0, type: "pdf", date: "2026-06-02", count: 26 },
          { item: 0, topic: 0, type: StudySessionType.QUESTIONS, date: "2026-06-02", count: 30, correct: 24 },
          { item: 1, topic: 1, type: "video", date: "2026-06-06", count: 1 },
          { item: 1, topic: 1, type: StudySessionType.QUESTIONS, date: "2026-06-07", count: 25, correct: 21 }
        ]
      },
      {
        id: "sefaz-finance",
        name: "Matemática Financeira",
        plannedStudyMinutes: 70,
        items: [
          { title: "Juros compostos", weight: 3, questionCount: 40, totalPages: 60 },
          { title: "Sistemas de amortização", weight: 2, questionCount: 35, totalPages: 70 }
        ],
        topics: [
          {
            id: "sefaz-finance-interest",
            name: "Taxas equivalentes",
            notebookName: "Tec - Matemática Financeira",
            notebookUrl: "https://tec.example.com/matematica-financeira"
          },
          {
            id: "sefaz-finance-amortization",
            name: "Tabela Price e SAC",
            notebookName: "Estratégia - Amortização",
            notebookUrl: "https://estrategia.example.com/amortizacao"
          }
        ],
        sessions: [
          { item: 0, topic: 0, type: "pdf", date: "2026-06-03", count: 18 },
          { item: 0, topic: 0, type: StudySessionType.QUESTIONS, date: "2026-06-03", count: 25, correct: 19 },
          { item: 1, topic: 1, type: "pdf", date: "2026-06-08", count: 20 },
          { item: 1, topic: 1, type: StudySessionType.QUESTIONS, date: "2026-06-08", count: 20, correct: 15 }
        ]
      }
    ]
  },
  {
    id: "trt-2-2026",
    name: "TRT-2 Analista 2026",
    wall: {
      noticeLabel: "Edital TRT-2 Analista 2026",
      noticeUrl: "https://www.trt2.jus.br",
      examLabel: "Prova TRT-2 2018",
      examUrl: "https://www.trt2.jus.br",
      notes: "Manter recorrência alta em trabalho, processo do trabalho e língua portuguesa."
    },
    subjects: [
      {
        id: "trt-labor-law",
        name: "Direito do Trabalho",
        plannedStudyMinutes: 100,
        items: [
          { title: "Contrato de trabalho", weight: 3, questionCount: 55, totalPages: 105 },
          { title: "Jornada e remuneração", weight: 3, questionCount: 50, totalPages: 90 }
        ],
        topics: [
          {
            id: "trt-labor-contract",
            name: "Vínculo empregatício",
            notebookName: "Tec - Direito do Trabalho",
            notebookUrl: "https://tec.example.com/direito-trabalho"
          },
          {
            id: "trt-labor-hours",
            name: "Horas extras e adicionais",
            notebookName: "QConcursos - Jornada",
            notebookUrl: "https://qconcursos.example.com/jornada"
          }
        ],
        sessions: [
          { item: 0, topic: 0, type: "pdf", date: "2026-06-01", count: 30 },
          { item: 0, topic: 0, type: StudySessionType.QUESTIONS, date: "2026-06-01", count: 35, correct: 29 },
          { item: 1, topic: 1, type: "pdf", date: "2026-06-05", count: 25 },
          { item: 1, topic: 1, type: StudySessionType.QUESTIONS, date: "2026-06-06", count: 30, correct: 24 }
        ]
      },
      {
        id: "trt-labor-procedure",
        name: "Processo do Trabalho",
        plannedStudyMinutes: 90,
        items: [
          { title: "Recursos trabalhistas", weight: 3, questionCount: 45, totalPages: 88 },
          { title: "Execução trabalhista", weight: 2, questionCount: 35, totalPages: 72 }
        ],
        topics: [
          {
            id: "trt-procedure-appeals",
            name: "Recurso ordinário e revista",
            notebookName: "Tec - Processo do Trabalho",
            notebookUrl: "https://tec.example.com/processo-trabalho"
          },
          {
            id: "trt-procedure-execution",
            name: "Liquidação e execução",
            notebookName: "Estratégia - Execução Trabalhista",
            notebookUrl: "https://estrategia.example.com/execucao-trabalhista"
          }
        ],
        sessions: [
          { item: 0, topic: 0, type: "pdf", date: "2026-06-02", count: 22 },
          { item: 0, topic: 0, type: StudySessionType.QUESTIONS, date: "2026-06-02", count: 25, correct: 20 },
          { item: 1, topic: 1, type: "video", date: "2026-06-07", count: 1 },
          { item: 1, topic: 1, type: StudySessionType.QUESTIONS, date: "2026-06-08", count: 20, correct: 16 }
        ]
      },
      {
        id: "trt-portuguese",
        name: "Português",
        plannedStudyMinutes: 70,
        items: [
          { title: "Redação oficial", weight: 2, questionCount: 30, totalPages: 55 },
          { title: "Pontuação", weight: 2, questionCount: 35, totalPages: 60 }
        ],
        topics: [
          {
            id: "trt-portuguese-official",
            name: "Comunicação oficial",
            notebookName: "Tec - Redação Oficial",
            notebookUrl: "https://tec.example.com/redacao-oficial"
          },
          {
            id: "trt-portuguese-punctuation",
            name: "Uso da vírgula",
            notebookName: "QConcursos - Pontuação",
            notebookUrl: "https://qconcursos.example.com/pontuacao"
          }
        ],
        sessions: [
          { item: 0, topic: 0, type: "pdf", date: "2026-06-03", count: 16 },
          { item: 0, topic: 0, type: StudySessionType.QUESTIONS, date: "2026-06-03", count: 20, correct: 17 },
          { item: 1, topic: 1, type: "pdf", date: "2026-06-09", count: 18 },
          { item: 1, topic: 1, type: StudySessionType.QUESTIONS, date: "2026-06-09", count: 20, correct: 16 }
        ]
      }
    ]
  }
];

/**
 * Seeds a complete demo workspace with three contests, each containing
 * subjects, study items, topics, question notebooks, and registered sessions.
 * Returns the created contests so callers can reference stable IDs.
 */
export async function seedTceSpDemo(dataStore: PluginDataStore): Promise<SeededContest[]> {
  const repositoryFactory = new EntityRepositoryFactory(dataStore);
  const createContest = new CreateContestUseCase(dataStore, repositoryFactory);
  const createSubject = new CreateSubjectUseCase(dataStore, repositoryFactory);
  const createItem = new CreateStudyItemUseCase(dataStore, repositoryFactory);
  const createTopic = new CreateTopicUseCase(dataStore, repositoryFactory);
  const linkNotebook = new LinkQuestionNotebookUseCase(dataStore, repositoryFactory);
  const updateWall = new UpdateContestWallUseCase(dataStore, repositoryFactory);
  const registerSession = new RegisterStudySessionUseCase(dataStore, repositoryFactory);
  const setActive = new SetActiveContestUseCase(dataStore, repositoryFactory);

  const seededContests: SeededContest[] = [];

  for (const contestSpec of DEMO_CONTESTS) {
    const contest = await createContest.execute({ id: contestSpec.id, name: contestSpec.name });
    const seededSubjects: SeededSubject[] = [];

    for (const subjectSpec of contestSpec.subjects) {
      const subject = await createSubject.execute({
        id: subjectSpec.id,
        contestId: contest.id,
        name: subjectSpec.name,
        plannedStudyMinutes: subjectSpec.plannedStudyMinutes
      });

      const items: StudyItem[] = [];
      for (let index = 0; index < subjectSpec.items.length; index += 1) {
        const itemSpec = subjectSpec.items[index];
        items.push(
          await createItem.execute({
            id: `${subject.id}-item-${index + 1}`,
            subjectId: subject.id,
            title: itemSpec.title,
            weight: itemSpec.weight,
            questionCount: itemSpec.questionCount,
            totalPages: itemSpec.totalPages
          })
        );
      }

      const topics: Topic[] = [];
      for (let index = 0; index < subjectSpec.topics.length; index += 1) {
        const topicSpec = subjectSpec.topics[index];
        const topic = await createTopic.execute({
          id: topicSpec.id,
          subjectId: subject.id,
          name: topicSpec.name
        });

        const linkedTopic = await linkNotebook.execute({
          topicId: topic.id,
          questionNotebook: {
            id: `${topic.id}-notebook`,
            name: topicSpec.notebookName,
            url: topicSpec.notebookUrl,
            solvedQuestions: 0,
            correctAnswers: 0
          }
        });
        topics.push(linkedTopic);
      }

      for (let index = 0; index < subjectSpec.sessions.length; index += 1) {
        const session = subjectSpec.sessions[index];
        await registerSession.execute({
          id: `${subject.id}-session-${index + 1}`,
          contestId: contest.id,
          subjectId: subject.id,
          studyItemId: items[session.item]?.id,
          topicId: topics[session.topic]?.id,
          type: session.type,
          studiedAt: `${session.date}T10:00:00.000Z`,
          pagesOrCount: session.count,
          correctAnswers: session.correct,
          completed: true
        });
      }

      seededSubjects.push({
        id: subject.id,
        name: subject.name,
        items,
        topics
      });
    }

    await updateWall.execute({
      contestId: contest.id,
      wall: {
        noticeLinks: [
          { id: `${contest.id}-notice`, label: contestSpec.wall.noticeLabel, url: contestSpec.wall.noticeUrl }
        ],
        examLinks: [
          { id: `${contest.id}-exam`, label: contestSpec.wall.examLabel, url: contestSpec.wall.examUrl }
        ],
        subjectSnapshots: seededSubjects.map((subject, index) => ({
          subjectId: subject.id,
          weight: contestSpec.subjects[index]?.items.reduce((total, item) => total + item.weight, 0) ?? 1,
          score: 8 - index * 0.5,
          targetItems: subject.items.map((item) => item.id)
        })),
        notes: contestSpec.wall.notes
      }
    });

    seededContests.push({
      id: contest.id,
      name: contest.name,
      subjects: seededSubjects
    });
  }

  await setActive.execute({ contestId: DEMO_CONTESTS[0].id });

  return seededContests;
}

/**
 * Minimal seed for tests that need just a contest + 1 subject.
 */
export async function seedMinimalContest(dataStore: PluginDataStore): Promise<{ contestId: string; subjectId: string }> {
  const repositoryFactory = new EntityRepositoryFactory(dataStore);
  const createContest = new CreateContestUseCase(dataStore, repositoryFactory);
  const createSubject = new CreateSubjectUseCase(dataStore, repositoryFactory);
  const setActive = new SetActiveContestUseCase(dataStore, repositoryFactory);

  const contest = await createContest.execute({ id: "contest-1", name: "TRT" });
  const subject = await createSubject.execute({
    id: "subject-1",
    contestId: contest.id,
    name: "Portuguese",
    plannedStudyMinutes: 60
  });
  await setActive.execute({ contestId: contest.id });

  return { contestId: contest.id, subjectId: subject.id };
}
